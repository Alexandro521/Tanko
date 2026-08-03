import type { ChapterPage, Chapter, MangaProvider, Translations, ChapterLanguage, WSZ, TermImgProtocolName, TankoTermImgOutput, LoadImageProps, ServerName } from "../types/types.js";
import { Configuration } from "./configuration.ts";
import { ImageLoader } from "./images.ts"
import { History } from "./history.ts";
import { Notify } from "./notify.ts";
import ansi from 'ansi-escapes'

export class PagesControl {
    private pages!: ChapterPage[];
    private currenPage!:ChapterPage
    private readCheckList!: boolean[]
    private pageIndex = 0;
    imageLoader = new ImageLoader()
    constructor(pages: ChapterPage[]) {
        this.pages = pages;
        this.currenPage = pages[0]
        this.readCheckList = new Array(pages.length).fill(false)
    }
    nextPage() {
        if (this.pageIndex < this.pages.length - 1)
            this.pageIndex++;
        this.currenPage = this.pages[this.pageIndex]
    }
    backPage() {
        if (this.pageIndex > 0)
            this.pageIndex--;
        this.currenPage = this.pages[this.pageIndex]
    }
    reset() {
        this.pageIndex = 0;
        this.currenPage = this.pages[0]
        this.imageLoader.free()
    }
    cacheHit(page: ChapterPage){
        return this.imageLoader.cacheHit(page)
    }
    async loadPage(props: LoadImageProps) {
        try {
            await this.imageLoader.loadImage(this.currenPage.src, props)
            if (!this.readCheckList[this.pageIndex]) {
                this.readCheckList[this.pageIndex] = true
            } 
        } catch (e) {
            if(e instanceof Error)
                Notify.pushError(e)
        }
    }
    render() {
        let page = this.currenPage
        if(!page?.src) return
        if (this.imageLoader.has(page.src)) {
            const image = this.imageLoader.get(page.src) as TankoTermImgOutput
            const pos = image.position
            process.stdout.write(ansi.cursorTo(pos.x, pos.y))
            process.stdout.write(ansi.cursorShow + image.encodedImg + ansi.cursorHide)
        }
    }
    getPages() {
        return this.pages
    }
    get readProgress(){
        return ((this.readCheckList.filter((e)=> e === true)).length * 100)/this.pages.length
    }
    setPages(newPages: ChapterPage[]) {
        this.pages = newPages;
        this.readCheckList = new Array(newPages.length).fill(false)
        this.reset()
    }
    get index(){
        return this.pageIndex
    }
    setIndex(newIndex: number) {
        this.pageIndex = newIndex
    }
    get PagesLength(){
        return this.pages.length
    }
}

export class TerminalControl {
    static isRaw = false;
    static graphicalProtocol: TermImgProtocolName ='kitty'
    static wsz: WSZ

    static exitRawMode(keyHandler: ((...arg: any[])=>void) | undefined = undefined ) {
        if(!TerminalControl.isRaw) return
        if (typeof keyHandler === 'function')
            process.stdin.removeListener('keypress', keyHandler);
        process.stdin.setRawMode(false);
        process.stdin.pause();
        TerminalControl.isRaw = false
    }
    static openRawMode(keyHandler: ((...arg: any[])=>void) | undefined = undefined) {
        if(TerminalControl.isRaw) return
        process.stdin.setRawMode(true)
        process.stdin.resume()
        process.stdin.setEncoding('utf8');
        TerminalControl.isRaw = true
        if (typeof keyHandler === 'function') {
            process.stdin.on('keypress', keyHandler)
        }
    }
    static async request(request: string): Promise<string | undefined> {
        return new Promise((resolve, reject) => {
            const isRaw = TerminalControl.isRaw
            let timer: null | NodeJS.Timeout = null
            if (!isRaw) TerminalControl.openRawMode()

            const recover = () => {
                process.stdin.removeListener('data', stdinHandle)
                if (!isRaw) TerminalControl.exitRawMode()
                reject(undefined)
            }

            const stdinHandle = (data: string) => {
                if (timer) clearTimeout(timer)
                process.stdin.removeListener('data', stdinHandle)
                if (!isRaw) TerminalControl.exitRawMode()
                resolve(data)
            }

            process.stdin.on('data', stdinHandle)
            timer = setTimeout(recover, 200)
            process.stdout.write(request)
        })
    }
    static async getWindowDimension(): Promise<WSZ | undefined> {
        try{
            let retrieves = 5
            let res: string = ''
            const regExp = /\x1b\[4;(\d+);(\d+)t/
            while(retrieves > 0){
                const str = await this.request('\x1B[14t')
                if (str && RegExp(regExp).test(str)) {
                    res = str
                    break
                }else {
                    retrieves--;
                    continue
                }
            }
            const match = res.match(regExp);
            if (match) {
                const cellsDimension = process.stdout.getWindowSize()
                const [height,width] = [parseInt(match[1], 10), parseInt(match[2], 10)]
                this.wsz = ({
                    w_height: height,
                    w_width: width,
                    w_colums: cellsDimension[0],
                    w_rows: cellsDimension[1],
                    w_cellPxWidth: width / cellsDimension[0],
                    w_cellPxHeight: height / cellsDimension[1],
                    w_ratio: width / height,
                    w_position_x: 0,
                    w_position_y: 0
                });
            return this.wsz
        }
        }catch(e){
            return undefined
        }
    };
}

export class ChapterControl {
    private chapters!: Chapter[];
    private index!: number;
    private server!: MangaProvider;
    private lang!: Translations;
    public hasBeenTracked = false

    constructor(chapterList: Chapter[], chapterIndex: number, lang: Translations, server: MangaProvider) {
        this.chapters = chapterList
        this.index = chapterIndex;
        this.lang = lang;
        this.server = server;
    }

    getChapterInfo() {
        const target = this.chapters[this.index]
        const targetChapter = target.translations[this.lang]
        return {
            ...target,
            chapterTarget: targetChapter,
            title: targetChapter?.title
        }
    }
    getChapter() {
        return this.chapters[this.index]
    }
    extractChapterSrcByLang(chapter: Chapter, lang: Translations): ChapterLanguage {
        if (chapter.translations[lang]) 
            return chapter.translations[lang];

        let targetChapter: any = null;
        Object.values(chapter.translations).some((e) => {
            if (e) {
                targetChapter = e as ChapterLanguage;
                return;
            }
        })
        return targetChapter as ChapterLanguage
    }
    async loadChapter() {
        try {
            if (!this.chapters[this.index])
                throw new Error("chapters out!");
            let target = this.extractChapterSrcByLang(this.chapters[this.index], this.lang);
            const data = await this.server.getChapterPages(target.id);
            this.hasBeenTracked = false
            return data;
        } catch (e) {
            if(e instanceof Error){
                Notify.pushError(e)
            }
        }
    }
    getLang() {
        return this.lang
    }
    async prevChapter() {
        if (this.index < this.chapters.length -1) {
            this.index++;
        }
    }
    async nextChapter() {
        if (this.index > 0) {
            this.index--;
        }
    }
    setChapterLanguage(newLang: Translations) {
        this.lang = newLang;
    }
    setChapterIndex(newIndex: number) {
        if (newIndex >= 0 && newIndex < this.chapters.length)
            this.index = newIndex;
    }
    geChapterIndex() {
        return this.index
    }
    isFirstOrLast(){
        /**
         * 0 = none
         * 1 = the first
         * -1  =the last
         */
        return this.index === 0 ? -1 : this.index === this.chapters.length  -1 ? 1 : 0
    }
    historySave(title: string, src: string, serverName: ServerName) {
        const chapter = this.extractChapterSrcByLang(this.getChapter(), this.lang)
        History.save({
            chapters_length: this.chapters.length,
            chapterSrc: chapter.id,
            last_index: this.index,
            last_lang: this.lang,
            server: serverName,
            last_title: chapter.title,
            mangaSrc: src,
            mangaTitle: title,
            time: Date.now()
        })
    }
}