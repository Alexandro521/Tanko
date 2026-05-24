import ora from "ora"
import chalk from "chalk"
import esc from "ansi-escapes"
import readLine from "node:readline"
import { stdin } from "node:process"
import prompts from "@alex_521/prompts"
import { Configuration } from "../functions/configuration.js"
import { SignalsCodes } from "../types/enum.js"
import { History } from "../functions/history.js"
import { terminalReaderChapterOptions } from "./prompts.js"
import { ImageCache, loadImage as imageLoader } from "../functions/images.js"
import type { Chapter,  ChapterPage, MangaServerInterface, MangaInfo, ChapterLangKey,ChapterLangStruct } from "../types/types.js"
import type { LangInterface } from "../types/lang.js"
const confInst = await Configuration.getInstance()
const loading = ora()
let instance = await Configuration.getInstance()
let { err_messages, loading_states } = instance.getLang()

instance.on('update',(_, __, lang)=>{
    err_messages = (lang as LangInterface).err_messages
    loading_states = (lang as LangInterface).loading_states
})
function debounce(func: Function, delay: number) {
    let timer: any;
    return async () => {
        clearTimeout(timer)
        timer = setTimeout(async () => await func(), delay);
    }
}

class PagesControl {
  private pages!: ChapterPage[];
   index = 0;
  constructor(pages: ChapterPage[]) {
    this.pages = pages;
  }
    nextPage() {
      if (this.index < this.pages.length-1)
        this.index++;
    }
    backPage(){
      if (this.index > 0)
        this.index--;
    }
    reset(){
      this.index = 0;
    }
  async loadPage() {
    try{
        loading.start(loading_states.default_loading)
        await imageLoader(this.pages[this.index])
        loading.stop()
      }catch(e){
        loading.fail(err_messages.page_loading.msg)
      }
  }
    set setPages(newPages: ChapterPage[]) {
      this.pages = newPages;
      this.index = 0;
    }
    set setIndex (newIndex: number) {
          
    }
}
class TerminalControl {
  static exitRawMode(keyHandler: any) {
    process.stdout.write(esc.cursorShow)
    if(keyHandler)
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
class ChapterControl{
  private chapters!: Chapter[];
  private index!: number;
  private server!: MangaServerInterface;
  private lang!: ChapterLangKey;

  constructor(chapterList: Chapter[], chapterIndex: number, lang: ChapterLangKey, server: MangaServerInterface) {
    this.chapters = chapterList;
    this.index = chapterIndex;
    this.lang = lang;
    this.server = server;
    }

  extractChapterSrcByLang(chapter: Chapter, lang: ChapterLangKey): ChapterLangStruct {
    if (chapter.src[lang]) return chapter.src[lang];
    let targetChapter: any = null;
    Object.values(chapter.src).some((e) => {
      if (e) {
        targetChapter = e as ChapterLangStruct;
        return;
      }
    })
  return targetChapter as ChapterLangStruct
}
  async loadChapter() {
    try {
      if (!this.chapters[this.index])
        throw new Error("chapters out");
      let target = this.extractChapterSrcByLang(this.chapters[this.index], this.lang);
      const data = await this.server.getChapterPages(target.src);
      return data;
    } catch (e) {
      console.log(e);
    }
  }
  async nextChapter() {
    if (this.index < this.chapters.length) {
      this.index++;
    }
    return null
  }
    async prevChapter() {
      if (this.index > 0) {
        this.index--;
      }
      return null
    }
  set chapterLanguage(newLang: ChapterLangKey) {
    this.lang = newLang;
  }
  set chapterIndex(newIndex: number) {
    if (newIndex > -1 && newIndex < this.chapters.length)
      this.index = newIndex;
  }
}
const centerText = (textLength: number, relativeofLenght: number) => {
    return Math.abs(Math.ceil(relativeofLenght / 2) - Math.ceil(textLength / 2))
}
const renderHeader = (title: string, mangatitle: string, index: number, n: number) => {
    const header = `${mangatitle}: ${chalk.gray(title)}\n`
    const currentPage = chalk.gray(`${index} de ${n}\n`)
    let startPoint = centerText(`${index}    ${n}`.length + 1, title.length + mangatitle.length + 1)

    process.stdout.write(esc.clearViewport);
    process.stdout.write(header);
    process.stdout.write(esc.cursorMove(startPoint, 0) + currentPage);
    // process.stdout.write(esc.cursorSavePosition +esc.cursorMove(0, rows-2))
    // process.stdout.write(chalk.gray(`   ←            →          Q & ESC            P                    N                C    \n`))
    // process.stdout.write(chalk.gray(` Anterior    Siguiente       Exit       capitulo anterior   capitulo siguiente    Opciones\n`))
    // process.stdout.write(esc.cursorRestorePosition)
};
const debugLogs = (src: string) => {
    process.stdout.write(`[DEBUG INFO] (CACHE SIZE): ${(ImageCache.cacheSize / 1000000).toFixed(2)} MB (MAX CACHE SIZE) : ${(ImageCache.MAX_SIZE / 1000000).toFixed(2)} MB (CACHE POINTER POSITION): ${ImageCache.pointer}, (PAGES IN CACHE) ${ImageCache.cache.size}, (FROM CACHE) ${ImageCache.cache.has(src)}\n\n`)
}

export async function terminalReader(manga: MangaInfo, startIndex: number, lang: ChapterLangKey, server: MangaServerInterface) {
    return new Promise<void>(async (resolve) => {
        const chapterCtrl = new ChapterControl(manga.chapters, startIndex, lang, server);
        const pageCtrl = new PagesControl([]);
      
        TerminalControl.openRawMode()
        const renderInfo = () => {
            console.log(esc.clearViewport)
            renderHeader(manga.title, manga.title, pageCtrl.index + 1, 1)
            //debugLogs(pagesNav.getState().src.src)
        }
        const pageDebounce = debounce(async () => {
                await pageCtrl.loadPage()
                process.stdout.write(esc.cursorHide)
                process.stdout.write(chalk.gray("\n   ←            →          Q & ESC            P                    N                C\nAnterior    Siguiente        Exit       capitulo anterior   capitulo siguiente    Opciones"
            ))
        }, 300)
        renderInfo()
      const chapterLoader = async (signal: SignalsCodes | undefined = undefined, handle: Function | undefined = undefined) => {
            try {
                if (stdin.isRaw) {
                    TerminalControl.exitRawMode(handle)
                }
                loading.start(loading_states.loading_chapter)

                if(signal === SignalsCodes.next_chapter) 
                  await chapterCtrl.nextChapter()
                else if(signal === SignalsCodes.previous_chapter)
                  await chapterCtrl.prevChapter()
              
                let newPages = await chapterCtrl.loadChapter()
                History.save({
                    chapters_length: manga.chapters.length,
                    last_index: startIndex,
                    last_lang: lang,
                    server: confInst.configuration.client.name,
                    last_title: manga.chapters[startIndex].title,
                    mangaSrc: manga.src,
                    mangaTitle: manga.title,
                    time: Date.now()
                  })
                pageCtrl.setPages = newPages ?? []
                loading.stop()
                if (stdin.isTTY) TerminalControl.openRawMode(handle)
                renderInfo()
                await pageCtrl.loadPage()
            } catch (e) {
                loading.fail(err_messages.no_results.msg)
                if (stdin.isTTY) TerminalControl.openRawMode(handle)
            }
        }
      await chapterLoader();
      const handleKeypress = async (__: string, key: any) => {

            const name: string = key.name;
            if (key && key.ctrl && name === 'c') {
                process.exit();
            } else if (name === 'left' || name === 'right') {
              if (name.startsWith('l')) 
                pageCtrl.backPage()
              else
                pageCtrl.nextPage()
              renderInfo()
               await pageDebounce()
            } 
            else if (name === 'q' || key.name === 'escape') {
                TerminalControl.exitRawMode(handleKeypress)
                resolve();
            } else if (name === 'c') {
                process.stdout.write(esc.clearViewport)
                TerminalControl.exitRawMode(handleKeypress)
                const options = await prompts(terminalReaderChapterOptions())
                if (!options.target) {
                    TerminalControl.openRawMode(handleKeypress)
                    console.log(esc.clearViewport)
                    renderInfo()
                    await pageCtrl.loadPage()
                    return
                }

                if (options.target === SignalsCodes.next_chapter)
                    await chapterLoader(SignalsCodes.next_chapter, handleKeypress)
                else if (options.target === SignalsCodes.previous_chapter, handleKeypress)
                    await chapterLoader(SignalsCodes.previous_chapter)

                else if (options.target === SignalsCodes.exit) {
                    TerminalControl.exitRawMode(handleKeypress)
                    console.log(esc.clearViewport)
                    resolve()
                }
            }
            else if (name === 'p' || name === 'P')
                await chapterLoader(SignalsCodes.previous_chapter, handleKeypress)
            else if (name === 'n' || name === 'N')
                await chapterLoader(SignalsCodes.next_chapter, handleKeypress)
      }
      process.stdin.on('keypress', handleKeypress)
    })
}
