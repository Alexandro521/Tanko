import type {
  ChapterPage,
  Chapter,
  MangaProvider,
  Translations,
  ChapterLanguage,
  WSZ,
  TermImgProtocolName,
  TankoTermImgOutput,
  LoadImageProps,
  ServerName,
  ImgPreloadingStrategy,
} from "../types/types.js";
import { ImageLoader } from "./images.ts";
import { History } from "./history.ts";
import { Notify } from "./notify.ts";
import ansi from "ansi-escapes";
import { RequestPool, type RequestStruct } from "./request.ts";
import { centerX, extractTitleByLang } from "../utils.ts";
import type { LangIso } from "./lang.ts";


export class PagesControl {
  private pages!: ChapterPage[];
  private currenPage!: ChapterPage;
  private readCheckList!: boolean[];
  private pageIndex = 0;
  private requestPool!:RequestPool
  public imageLoader!:ImageLoader
  constructor(pages: ChapterPage[]) {
    this.imageLoader = new ImageLoader();
    this.pages = pages;
    this.currenPage = pages[0];
    this.readCheckList = new Array(pages.length).fill(false);
    this.requestPool = new RequestPool()

    this.requestPool.setResponseChecker((response, reject)=>{
      if (response.ok) {
        const contentType = response.headers.get('Content-Type')
        if (!contentType || (!contentType.startsWith('image') && contentType !== ('application/octet-stream') )){
          const reason = `Invalid http header: Content-Type, \n expected: \"image/*\" ~ received: ${contentType}`
          reject(reason)
        }
      }else{
        reject(`Invalid HTTP response. Status: ${response.status} ${response.statusText}`)
      }
    })

    this.requestPool.on('resolve', async (e: {url: string, rid: number})=>{
      const key =  `${e.url}_request`
      const res = this.requestPool.read(e.url, false)
      if(res instanceof Response){  
        const buffer = await res.arrayBuffer()
        this.imageLoader.set(key, buffer)
      }
    })

  }
  preLoader(limit = 5, estrategy: ImgPreloadingStrategy){
    const srsc: string[] = []

    switch(estrategy){
      case 'around':{
        const pageIndex = this.pageIndex
        for(let i = 1; i <= limit; i++){

          const srcPageLeft = this.pages[ Math.max(pageIndex - i, 0) ].src
          const srcPageRight = this.pages[ Math.min(pageIndex + i, this.PagesLength -1) ].src

          const imageLoaderKeyLeft = `${srcPageLeft}_request`
          const imageLoaderKeyRight = `${srcPageRight}_request`

          if(!this.requestPool.has(srcPageLeft)  && !this.imageLoader.has(imageLoaderKeyLeft))
          {
            srsc.push(srcPageLeft)
          }
          if(!this.requestPool.has(srcPageRight)  && !this.imageLoader.has(imageLoaderKeyRight)){
            srsc.push(srcPageRight)
          }
        }
      }
      case 'forward':{
        for(let i = 1; i <= limit; i++){
          const srcPage = this.pages[(this.pageIndex + i, this.PagesLength -1)].src
          const imageLoaderKey = `${srcPage}_request`
          if(!this.requestPool.has(srcPage)  && !this.imageLoader.has(imageLoaderKey)){
            srsc.push(srcPage)
          }
        }
      }
      case 'fill':{
        let i = 0;
        while(i < this.pages.length && srsc.length < limit){
          const pageSrc = this.pages[i].src
          const key = `${pageSrc}_request`
          const isRead = this.readCheckList[i]
          if(!isRead && !this.requestPool.has(pageSrc) && !this.imageLoader.has(key)){
            srsc.push(pageSrc)
          }
          i++
        }
      }
    }
    for(const src of srsc){
        this.requestPool.push(src)
    }
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
    this.imageLoader.free();
    this.requestPool.free()
  }
  cacheHit(page: ChapterPage) {
    return this.imageLoader.cacheHit(page);
  }
  //@ts-ignore
  async loadPage(props: LoadImageProps) {
    try {
      const imgUrl = this.currenPage.src
      const imageLoaderKey = `${imgUrl}_request`
      const hasImageBuffer = this.imageLoader.has(imageLoaderKey)
      let hasRequest = this.requestPool.has(imgUrl)
      const { invalidateCache } = props

      if(!(hasRequest && hasImageBuffer) || invalidateCache){
        this.requestPool.push(imgUrl)
        hasRequest =  this.requestPool.has(imgUrl)
      }

      if ((hasRequest && !hasImageBuffer) || invalidateCache) {
        const promiseStatus = await this.requestPool.waitFor(imgUrl)
        let request = this.requestPool.get(imgUrl) as RequestStruct
        if (!promiseStatus) {
          for(let retrieve = 0; retrieve < 3; retrieve++){
            this.requestPool.push(imgUrl)
            await this.requestPool.waitFor(imgUrl)
            request = this.requestPool.get(imgUrl) as RequestStruct
            if(request.status === 'resolve') break
          }
          if(request.status !== 'resolve'){
            throw new Error(`--Page ${this.pageIndex +1}--\n${request.messageError} - 3 retrieves`)
          }
        }
        const response = this.requestPool.read(imgUrl, true)
        if(response){
          const arrayBuffer = await response.arrayBuffer()
          this.imageLoader.set(imageLoaderKey, arrayBuffer)
        } else{
          throw new Error(`Invalid HTTP response`)
        }
      }
      await this.imageLoader.loadImage(imgUrl, props);
      if (!this.readCheckList[this.pageIndex]) {
        this.readCheckList[this.pageIndex] = true;
      }
      if(props.enableImgPreloading){
        this.preLoader(props.maxImagePreloading, props.imgPreloadingStrategy)
      }
    } catch (e) {
      if (e instanceof Error) Notify.pushError(e);
    }
  }
  render() {
    let page = this.currenPage;
    if (!page?.src) return;
    if (this.imageLoader.has(page.src)) {
      const image = this.imageLoader.get(page.src) as TankoTermImgOutput;
      if(!image?.encodedImg) return;
      process.stdout.write(
        ansi.cursorShow + image.encodedImg + ansi.cursorHide,
      );
    }
    else {
      const noti = Notify.getInstace()
      const box = noti.getf()
      if(box){
        const position = centerX(box.width, process.stdout.columns)
        box.strBox.split('\n').forEach(line=>{
            process.stdout.write(ansi.cursorForward(position) + line + '\n')
        })
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
  historySave(title: string, mangaSrc: string, serverName: ServerName) {
    const chapter = this.extractChapterSrcByLang(this.getChapter(), this.lang);
    History.save({
      chapters_length: this.chapters.length,
      chapterSrc: chapter.id,
      last_index: this.index,
      last_lang: this.lang,
      server: serverName,
      last_title: chapter.title,
      mangaSrc: mangaSrc,
      mangaTitle: title,
      time: Date.now(),
    });
  }
}
