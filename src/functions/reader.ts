import ora from "ora";
import type { ChapterPage, Chapter, MangaProvider, Translations, ChapterLanguage } from "../types/types.js";
import { Configuration } from "./configuration.js";
import { loadImage as imageLoader } from "./images.js"
import { History } from "./history.js";
import readLine from 'readline'
import esc from 'ansi-escapes'

const LOADER = ora()
let CONFIGURATION = await Configuration.getInstance()
let { err_messages, loading_states, reader } = await CONFIGURATION.getLanguageInterface()

export class PagesControl {
    private pages!: ChapterPage[];
    private readCheckList!: boolean[]
    private readProgress = 0
    private pageIndex = 0;

    constructor(pages: ChapterPage[]) {
        this.pages = pages;
        this.readCheckList = new Array(pages.length).fill(false)
    }
    nextPage() {
        if (this.pageIndex < this.pages.length - 1)
            this.pageIndex++;
    }
    backPage() {
        if (this.pageIndex > 0)
            this.pageIndex--;
    }
    reset() {
        this.pageIndex = 0;
        this.readProgress = 0;
    }
    async loadPage() {
        try {
            if (!this.readCheckList[this.pageIndex]) {
                this.readCheckList[this.pageIndex] = true
                this.readProgress++
                if(!LOADER.isSpinning)
                    LOADER.start(loading_states.default_loading)
            }
            await imageLoader(this.pages[this.pageIndex])
            LOADER.stop()
        } catch (e) {
            LOADER.fail(err_messages.page_loading.msg)
        }
    }
    getPages() {
        return this.pages
    }
    getReadProgress(){
        return (this.readProgress*100)/this.pages.length
    }
    setPages(newPages: ChapterPage[]) {
        this.pages = newPages;
        this.readCheckList = new Array(newPages.length).fill(false)
        this.reset()
    }
    getIndex(){
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
    static exitRawMode(keyHandler: any) {
        process.stdout.write(esc.cursorShow)
        if (keyHandler)
            process.stdin.removeListener('keypress', keyHandler);
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdout.write(esc.clearViewport);
    }
    static openRawMode(keyHandler: any = undefined) {
        readLine.emitKeypressEvents(process.stdin)
        process.stdin.resume()
        process.stdin.setRawMode(true)
        process.stdin.setEncoding('utf8');
        process.stdout.write(esc.cursorHide)
        if (keyHandler) {
            process.stdin.on('keypress', keyHandler)
        }
    }
}

export class ChapterControl {
    private chapters!: Chapter[];
    private index!: number;
    private server!: MangaProvider;
    private lang!: Translations;
    public mark = false

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
        if (chapter.translations[lang]) return chapter.translations[lang];
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
                throw new Error("chapters out");
            let target = this.extractChapterSrcByLang(this.chapters[this.index], this.lang);
            const data = await this.server.getChapterPages(target.id);
            this.mark = false
            return data;
        } catch (e) {
            console.log(e);
        }
    }
    getLang() {
        return this.lang
    }
    async prevChapter() {
        if (this.index < this.chapters.length) {
            this.index++;
        }
        return null
    }
    async nextChapter() {
        if (this.index > 0) {
            this.index--;
        }
        return null
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
    historySave(title: string, src: string) {
        const chapter = this.extractChapterSrcByLang(this.getChapter(), this.lang)
        History.save({
            chapters_length: this.chapters.length,
            chapterSrc: chapter.id,
            last_index: this.index,
            last_lang: this.lang,
            server: CONFIGURATION.configuration.server.name,
            last_title: chapter.title,
            mangaSrc: src,
            mangaTitle: title,
            time: Date.now()
        })
    }
}