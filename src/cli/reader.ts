import ora from "ora"
import chalk from "chalk"
import esc from "ansi-escapes"
import readLine from "node:readline"
import { stdin } from "node:process"
import prompts from "@alex_521/prompts"
import { Configuration } from "src/functions/configuration.js"
import { SignalsCodes } from "../types/enum.js"
import { History } from "../functions/history.js"
import { terminalReaderChapterOptions } from "./prompts.js"
import { ImageCache, loadImage as imageLoader } from "../functions/images.js"
import type { ChapterInfo, ChapterPage, MangaServerInterface } from "../types/types.js"
import type { LangInterface } from "src/types/lang.js"

const loading = ora()
let instance = await Configuration.getInstance()
let {err_messages, loading_states} = instance.getLang()
instance.on('update',(_, __, lang)=>{
    err_messages = (lang as LangInterface).err_messages
    loading_states = (lang as LangInterface).loading_states
})

const loadImage = async (e: ChapterPage)=>{
    try{
        loading.start(loading_states.default_loading)
        await imageLoader(e)
        loading.stop()
    }catch(e){
        loading.fail(err_messages.page_loading.msg)
    }
}

function debounce(func: Function, delay: number) {
    let timer: any;
    return async (src: ChapterPage) => {
        clearTimeout(timer)
        timer = setTimeout(async () => await func(src), delay);
    }
}

function PagesNavigator(pages: ChapterPage[]) {
    let index = 0;
    return {
        nextPage: () => {
            if (index < pages.length - 1) index++;
            else return undefined
            return pages[index]
        },
        backPage: () => {
            if (index > 0) index--;
            else return undefined
            return pages[index]
        },
        reset: () => {
            index = 0;
        },
        setPages: (newPages: ChapterPage[]) => {
            pages = newPages;
            index = 0;
        },
        getState: () => {
            return { src: pages[index], index }
        }
    }
}

function TerminalControl() {
    return {
        exitRawMode: (keyHandler: any) => {
            process.stdout.write(esc.cursorShow)
            process.stdin.removeListener('keypress', keyHandler);
            process.stdin.setRawMode(false);
            process.stdin.pause();
            process.stdout.write(esc.clearViewport);
        },
        openRawMode: (keyHandler: any = undefined) => {
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
}

function chapterNavigator(previousChapter: string | null, nextChapter: string | null, server: MangaServerInterface) {
    return {
        nextChapter: async () => {
          //  console.log(previousChapter, nextChapter)
            if (!nextChapter) return null
            const data = await server.getChapterPages(nextChapter)

            previousChapter = data.prevChapter
            nextChapter = data.nextChapter
            return data;
        },
        backChapter: async () => {
           // console.log(previousChapter, nextChapter)
            if (!previousChapter) return null
            const data = await server.getChapterPages(previousChapter)
            previousChapter = data.prevChapter
            nextChapter = data.nextChapter
            return data;
        }
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

export async function terminalReader(props: ChapterInfo, server: MangaServerInterface) {
    
    return new Promise<void>(async (resolve) => {

        const terminal = TerminalControl()
        const pagesNav = PagesNavigator(props.pages)
        const chapterNav = chapterNavigator(props.prevChapter, props.nextChapter, server)
        History.save(props)
        terminal.openRawMode()

        const renderInfo = () => {
            console.log(esc.clearViewport)
            renderHeader(props.title, props.mangaTitle, pagesNav.getState().index + 1, props.pages.length)
            //debugLogs(pagesNav.getState().src.src)
        }

        const pageDebounce = debounce(async (e: ChapterPage) => {
                await loadImage(e)
                process.stdout.write(esc.cursorHide)
                process.stdout.write(chalk.gray("\n   ←            →          Q & ESC            P                    N                C\nAnterior    Siguiente        Exit       capitulo anterior   capitulo siguiente    Opciones"
            ))
        }, 300)

        renderInfo()
        await loadImage(pagesNav.getState().src)

        const chapterLoader = async (signal: SignalsCodes) => {
            try {
                if (stdin.isRaw) {
                    terminal.exitRawMode(handleKeypress)
                }
                loading.start(loading_states.loading_chapter)

                const data = signal === SignalsCodes.nex_chapter ? 
                await chapterNav.nextChapter() : 
                await chapterNav.backChapter()

                if (!data) throw new Error(err_messages.no_results.msg);
                props = { ...props, ...data }
                History.save(props)
                pagesNav.setPages(data.pages)
                loading.stop()
                if (stdin.isTTY) terminal.openRawMode(handleKeypress)
                renderInfo()
                await loadImage(pagesNav.getState().src)
            } catch (e) {
                loading.fail(err_messages.no_results.msg)
                if (stdin.isTTY) terminal.openRawMode(handleKeypress)
            }
        }

        const handleKeypress = async (str: string, key: any) => {

            const name: string = key.name;
            if (key && key.ctrl && name === 'c') {
                process.exit();
            } else if (name === 'left') {
                let src = pagesNav.backPage()
                if (!src) return
                renderInfo()
                await pageDebounce(src)

            } else if (name === 'right') {
                let src = pagesNav.nextPage()
                if (!src) return
                renderInfo()
                await pageDebounce(src);

            } else if (name === 'q' || key.name === 'escape') {
                terminal.exitRawMode(handleKeypress)
                resolve();
            } else if (name === 'c') {
                process.stdout.write(esc.clearViewport)
                terminal.exitRawMode(handleKeypress)

                const options = await prompts(terminalReaderChapterOptions())

                if (!options.target) {
                    terminal.openRawMode(handleKeypress)
                    console.log(esc.clearViewport)
                    renderInfo()
                    await loadImage(pagesNav.getState().src)
                    return
                }

                if (options.target === SignalsCodes.nex_chapter)
                    await chapterLoader(SignalsCodes.nex_chapter)

                else if (options.target === SignalsCodes.previous_chapter)
                    await chapterLoader(SignalsCodes.previous_chapter)

                else if (options.target === SignalsCodes.exit) {
                    terminal.exitRawMode(handleKeypress)
                    console.log(esc.clearViewport)
                    resolve()
                }
            }
            else if (name === 'p' || name === 'P')
                await chapterLoader(SignalsCodes.previous_chapter)
            else if (name === 'n' || name === 'N')
                await chapterLoader(SignalsCodes.nex_chapter)
        }
        process.stdin.on('keypress', handleKeypress)
    })
}