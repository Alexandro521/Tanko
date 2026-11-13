import type {
  ChapterPage,
  Chapter,
  MangaProvider,
  Translations,
  ChapterLanguage,
  WSZ,
  TermImgProtocolName,
  LoadImageProps,
  ImgPreloadingStrategy,
} from "../types/types.js";
import { ImageStorage } from "./images.ts";
import { Notify } from "./notify.ts";
import ansi from "ansi-escapes";
import { Net, RequestStatus } from "./net.ts";
import { centerX } from "../utils.ts";
import type { LangIso } from "./lang.ts";
import { Configuration } from "./configuration.ts";
import { UNITS } from "../types/enum.ts";

const CONF = await Configuration.getInstance()
export class PagesControl {
  private pages!: ChapterPage[];
  private currenPage!: ChapterPage;
  private readCheckList!: boolean[];
  private pageIndex = 0;
  private net!:Net
  public imgStorage!:ImageStorage

  constructor() {
    this.imgStorage = new ImageStorage({
      maxSize: UNITS.MB * 1024, 
      maxLength: 256, 
      TTL: 0
    });
    this.pages = [];
    this.currenPage = this.pages[0];
    this.readCheckList = new Array(this.pages.length).fill(false);
    this.net = new Net({
      requestMaxRetries: 5,
      storage: {
        maxLength: 24,
        maxSize: UNITS.MB * 512,
        TTL: UNITS.MINUTE_MILISECONDS * 2
      }
    })
    this.net.appendMiddleWare((headers, reject)=>{
        const contentType = headers.get('Content-Type')
        if (!contentType || (!contentType.startsWith('image') && contentType !== ('application/octet-stream'))){
          const reason = `Invalid http header: Content-Type, \n expected: \"image/*\" ~ received: ${contentType}`
          reject(false, reason)    
      }
    })
    this.net.event.on('resolve', async rid =>{
      const {url} = this.net.get(rid)!
      const res = this.net.read(rid, false)
      if(res instanceof Response){
          const exists = this.imgStorage.has(url)
          if(!exists.buffer){
            this.imgStorage.add(url, ( await res.arrayBuffer()))
          }
      }
    })
  }
  pagePreFetch(range = 5, estrategy: ImgPreloadingStrategy){
    let candidates: ChapterPage[];
    switch(estrategy){
      case 'around':{
        let start = Math.max(0, this.pageIndex - range)
        let end = Math.min(this.PagesLength, this.pageIndex + range)
        candidates = this.pages.slice(start, end)
        break
      }
      case 'forward':{
        let end = Math.min(this.PagesLength, this.pageIndex + range)
        candidates = this.pages.slice(this.pageIndex, end)
        break
      }
      case 'fill':{
        candidates = []
        for(let i = 0, n = range; i < this.PagesLength && n > 0; i++){
          if(!this.readCheckList[i]){
              candidates.push(this.pages[i])
              n--;
          }
        }
        break
      }
    }
    const {customHeaders} = CONF.conf_provider.provider
    candidates.filter(({src})=> {
      const st  = this.imgStorage.has(src)
      return !(st.buffer || st.codec || this.net.has(src))
    }).forEach(e=>{
      this.net.pushRequest(e.src, {headers: customHeaders})
    })
  }
  nextPage() {
    if (this.pageIndex < this.pages.length - 1) {
      this.pageIndex++;
    }
    this.currenPage = this.pages[this.pageIndex];
  }
  backPage() {
    if (this.pageIndex > 0) {
      this.pageIndex--;
    }
    this.currenPage = this.pages[this.pageIndex];
  }
  reset() {
    this.pageIndex = 0;
    this.currenPage = this.pages[0];
    this.imgStorage.free();
    this.net.free()
  }
  storageHit(page: ChapterPage) {
    const has = this.imgStorage.has(page.src)
    return has.buffer || has.codec;
  }
  //@ts-ignore
  async loadPage(props: LoadImageProps): Promise<boolean> {
    try {
      const imageSrc = this.currenPage.src
      const isImageInStorage = this.imgStorage.has(imageSrc)

      if (!isImageInStorage.buffer || props.invalidateCache) {
        if (!this.net.has(imageSrc) || props.invalidateCache){
          this.net.pushRequest(imageSrc)
        }
        const rid = this.net.getRid(imageSrc)!
        
        if ( await this.net.waitFor(rid) && this.net.getStatus(rid)! === RequestStatus.resolve) {
          const arrayBuffer = await (this.net.read(rid, false)).arrayBuffer()
          this.imgStorage.add(imageSrc, arrayBuffer)
        } else {
          throw new Error(`--Page ${this.pageIndex + 1}--\n${''} - fail to fetch`)
        }
      }
      const has = this.imgStorage.has(imageSrc)
      if(has.buffer){
        await this.imgStorage.makeImage(imageSrc, props);
        if ( this.readCheckList[this.pageIndex] === false ) {
          this.readCheckList[this.pageIndex] = true;
        }
        if(props.enableImgPreloading){
          this.pagePreFetch(props.maxImagePreloading, props.imgPreloadingStrategy)
        }
      }
      return true
    } catch (e) {
      if (e instanceof Error) {
        if(e.message !== 'abort'){
          Notify.pushError(e);
          return true
        }
        return false
      }
    }
  }
  aborLoading(){
    try{
      const info = this.net.getByUrl(this.currenPage.src)
      if(info){
        if(info.status === RequestStatus.pendding){
          this.net.abort(info.rid)
        }
      }
    }catch(e){

    }
  }
  renderPage(pageIndex: number) {
    try{
      const page = this.pages[pageIndex]
      const has = this.imgStorage.has(page.src)
      if (has.codec) {
        const image = this.imgStorage.getImg(this.currenPage.src);
        if(image?.encodedImg){
          process.stdout.write(
            image.encodedImg + ansi.cursorHide,
          );
        } else throw new Error('Error: image buffer loss')
      }
    }catch(err){
      if(err instanceof Error){
        const nofify = Notify.getInstace()
        const box = nofify.getf()
        if(box){
          const position = centerX(box.width, process.stdout.columns)
          box.strBox.split('\n').forEach(line=>{
              process.stdout.write(ansi.cursorForward(position) + line + '\n')
          })
        }
      }
    }
  }
  getPages() {
    return this.pages;
  }
  get readProgress() {
    return (
      (this.readCheckList.filter((e) => e === true).length * 100) /
      this.pages.length
    );
  }
  get readPages(){
    return (this.readCheckList.filter(e=> e).length)
  }
  setPages(newPages: ChapterPage[]) {
    this.pages = newPages;
    this.readCheckList = new Array(newPages.length).fill(false);
    this.reset();
  }
  get index() {
    return this.pageIndex;
  }
  setIndex(newIndex: number) {
    this.pageIndex = newIndex;
    this.currenPage = this.pages[newIndex]
  }
  setProgress(count: number) {
    const n  =  Math.min(this.readCheckList.length, count)
    for(let i = 0;  i < n; i++){
      this.readCheckList[i] = true
    }
  }
  free(){
    this.net.free()
    this.imgStorage.free()
  }
  get PagesLength() {
    return this.pages.length;
  }
}

export class TerminalControl {
  static isRaw = false;
  static graphicalProtocol: TermImgProtocolName = "kitty";
  static wsz: WSZ;

  static exitRawMode(
    keyHandler: ((...arg: any[]) => void) | undefined = undefined,
  ) {
    if (!TerminalControl.isRaw) return;
    if (typeof keyHandler === "function")
      process.stdin.removeListener("keypress", keyHandler);
    process.stdin.setRawMode(false);
    process.stdin.pause();
    TerminalControl.isRaw = false;
  }
  static openRawMode(
    keyHandler: ((...arg: any[]) => void) | undefined = undefined,
  ) {
    if (TerminalControl.isRaw) return;
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");
    TerminalControl.isRaw = true;
    if (typeof keyHandler === "function") {
      process.stdin.on("keypress", keyHandler);
    }
  }
  static async request(request: string): Promise<string | undefined> {
    return new Promise((resolve, reject) => {
      const isRaw = TerminalControl.isRaw;
      let timer: null | NodeJS.Timeout = null;
      if (!isRaw) TerminalControl.openRawMode();

      const recover = () => {
        process.stdin.removeListener("data", stdinHandle);
        if (!isRaw) TerminalControl.exitRawMode();
        reject(undefined);
      };

      const stdinHandle = (data: string) => {
        if (timer) clearTimeout(timer);
        process.stdin.removeListener("data", stdinHandle);
        if (!isRaw) TerminalControl.exitRawMode();
        resolve(data);
      };

      process.stdin.on("data", stdinHandle);
      timer = setTimeout(recover, 1000);
      process.stdout.write(request);
    });
  }
  static async getWindowDimension(): Promise<WSZ | undefined> {
    let retrieves = 5;
    let termResponse: string = "";
    const regExp = /\[\d+;(\d+);(\d+)t?/;
    
    while (retrieves > 0) {
      try {
        const str = await this.request("\x1B[14t");
        if (str && RegExp(regExp).test(str)) {
          termResponse = str;
          break;
        } else {
          retrieves--;
          continue;
        }
      } catch (e) {
        retrieves--;
        continue;
      }
    }
    const stdoutSize = process.stdout.getWindowSize();
    
    const wsz = {
        w_height: stdoutSize[1],
        w_width: stdoutSize[0],
        w_colums: stdoutSize[0],
        w_rows: stdoutSize[1],
        w_cellPxWidth: 11,
        w_cellPxHeight: 22,
        w_ratio: (stdoutSize[0] * 0.5) / stdoutSize[1],
        w_position_x: 0,
        w_position_y: 0,
    }
    if (regExp.test(termResponse)) {
      const match = termResponse.match(regExp) as RegExpMatchArray
      const [height, width] = [parseInt(match[1], 10), parseInt(match[2], 10)];
      wsz.w_height = height;
      wsz.w_width = width;
      wsz.w_cellPxHeight = height / stdoutSize[1]
      wsz.w_cellPxWidth = width / stdoutSize[0]
      const cellsRatio = wsz.w_cellPxWidth / wsz.w_cellPxHeight;
      wsz.w_ratio = (stdoutSize[0] * cellsRatio) / stdoutSize[1];
    }
    this.wsz = wsz;
    return wsz;
  }
}

export class ChapterControl {
  private chapters!: Chapter[];
  private index!: number;
  private server!: MangaProvider;
  private lang!: Translations;
  public hasBeenTracked = false;

  constructor(
    chapterList: Chapter[],
    chapterIndex: number,
    lang: Translations,
    server: MangaProvider,
  ) {
    this.chapters = chapterList;
    this.index = chapterIndex;
    this.lang = lang;
    this.server = server;
  }

  getChapterInfo() {
    const chapter = this.chapters[this.geChapterIndex()];
    if(!chapter) throw new Error('chapter is undefined, bad chapters loading')
    const chapterLanguage = this.extractChapterSrcByLang(chapter, this.lang);
    return {
      ...chapter,
      chapterTarget: chapterLanguage,
      title: chapterLanguage.title,
    };
  }

  getChapter() {
    return this.chapters[this.index] || this.chapters[this.chapters.length -1];
  }
  extractChapterSrcByLang(chapter: Chapter, lang: LangIso): ChapterLanguage {
    if(!(chapter?.translations)) throw new Error('invalid input')
    if (chapter.translations[lang]) return chapter.translations[lang];
    const avalibelTranslations = Object.keys(chapter.translations) as LangIso[]
    return chapter.translations[avalibelTranslations[0]] as ChapterLanguage
  }

  async loadChapter() {
    let chapter = this.chapters[this.index]
    if (!chapter) chapter = this.chapters[this.chapters.length - 1]
    const chapterLanguage = this.extractChapterSrcByLang(chapter, this.lang)
    const data = await this.server.getChapterPages(chapterLanguage.id);
    this.hasBeenTracked = false;
    return data;
  }
  getLang() {
    return this.lang;
  }
  async prevChapter() {
    if (this.index < this.chapters.length - 1) {
      this.index++;
    }
  }
  async nextChapter() {
    if (this.index > 0) {
      this.index--;
    }
  }
  setChapterLanguage(newLang: LangIso) {
    this.lang = newLang;
  }
  setChapterIndex(newIndex: number) {
    if (newIndex >= 0 && newIndex < this.chapters.length) this.index = newIndex;
  }
  geChapterIndex() {
    return this.index;
  }
  /**
   * @description
   * `-1` the last chapter
   * `0` none
   * `1` the first chapter
   */
  isFirstOrLast() {
    return this.index === 0
      ? -1
      : this.index === this.chapters.length - 1
        ? 1
        : 0;
  }
}
