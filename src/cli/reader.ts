import ora from "ora"
import chalk from "chalk"
import esc from "ansi-escapes"
import { stdin } from "node:process"
import prompts, { type Choice } from "@alex_521/prompts"
import { Configuration } from "../functions/configuration.js"
import { SignalsCodes, ConfigurationEvents } from "../types/enum.js"
import { askChapterLang, chapterListPrompt, terminalReaderChapterOptions } from "./prompts.js"
import type { Chapter, MangaProvider, MangaInfo, Translations } from "../types/types.js"
import type { LangInterface } from "../types/lang.js"
import { LocalTracker, type LocalTrackerProps } from "../trackers/local.js"
import { MediaListStatus } from "../types/enum.js"
import { ChapterControl, PagesControl, TerminalControl } from "../functions/reader.js"

const LOADER = ora()
let CONFIGURATION = await Configuration.getInstance()
let { err_messages, loading_states, reader } = await CONFIGURATION.getLanguageInterface()
const localTracker = LocalTracker.getInstance()
let anilistTracker = CONFIGURATION.getTracker('anilist')

CONFIGURATION.on('update', (_, __, lang) => {
  err_messages = (lang as LangInterface).err_messages
  loading_states = (lang as LangInterface).loading_states
  reader = (lang as LangInterface).reader
})
CONFIGURATION.on(ConfigurationEvents.updateLanguage, (lang) => {
  err_messages = (lang as LangInterface).err_messages
  loading_states = (lang as LangInterface).loading_states
  reader = (lang as LangInterface).reader
})
CONFIGURATION.on(ConfigurationEvents.login, () => {
  anilistTracker = CONFIGURATION.getTracker('anilist')
})

function debounce(func: Function, delay: number) {
  let timer: any;
  return async () => {
    clearTimeout(timer)
    timer = setTimeout(async () => await func(), delay);
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
};
/*
const debugLogs = (src: string) => {
    process.stdout.write(`[DEBUG INFO] (CACHE SIZE): ${(ImageCache.cacheSize / 1000000).toFixed(2)} MB (MAX CACHE SIZE) : ${(ImageCache.MAX_SIZE / 1000000).toFixed(2)} MB (CACHE POINTER POSITION): ${ImageCache.pointer}, (PAGES IN CACHE) ${ImageCache.cache.size}, (FROM CACHE) ${ImageCache.cache.has(src)}\n\n`)
}*/

export async function terminalReader(
  mangaInfo: MangaInfo,
  chapters: Chapter[],
  startIndex: number,
  lang: Translations
) {
  return new Promise<void>(async (resolve) => {
    const server = CONFIGURATION.getServer()
    const chapterCtrl = new ChapterControl(chapters, startIndex, lang, server);
    const pageCtrl = new PagesControl([]);
    const anilistId = mangaInfo.anilistId ? Number(mangaInfo.anilistId) :  await anilistTracker.instance.getId(mangaInfo)
    TerminalControl.openRawMode()

    const renderInfo = () => {
      const chapterInfo = chapterCtrl.getChapterInfo()
      console.log(esc.clearViewport)
      const progresstr = ' ⏺ Progress: ' + (pageCtrl.getReadProgress()).toFixed(1) + '%'
      renderHeader(mangaInfo.title + progresstr + ` ⏺ ${anilistId}`, (chapterInfo.title || ''), pageCtrl.getIndex() + 1, pageCtrl.PagesLength)
      // debugLogs(mangaInfo.src)
    }
    const pageDebounce = debounce(async () => {
      if (pageCtrl.getReadProgress() >= 75 && !chapterCtrl.mark) {
        const chapterInfo = chapterCtrl.getChapterInfo()
        const localTrackerProps: LocalTrackerProps = {
          chapterCount: chapters.length,
          chapterIndex: chapterInfo.chapter,
          mangaId: mangaInfo.src
        }
        if (!localTracker.exists(localTrackerProps)) {
          await localTracker.regist(localTrackerProps)
        }
        const markStatus = await localTracker.markAsRead(localTrackerProps)
        if (anilistTracker.isAuth && !markStatus && anilistId) {
          await anilistTracker.instance.track({
            mediaId: anilistId,
            lastRead: chapterInfo.chapter,
            progress: chapterInfo.chapter,
            status: MediaListStatus.Current,
          })
          chapterCtrl.mark = true
        }
      }
      await pageCtrl.loadPage()
      process.stdout.write(esc.cursorHide)
      const controlBar = `\n   ←            →          Q & ESC            P                    N                C\n${reader.prev_page}    ${reader.next_page}        ${reader.exit}       ${reader.prev_ch}   ${reader.next_ch}    ${reader.options}`
      process.stdout.write(chalk.gray(controlBar))
    }, 300)
    
    renderInfo()
    const chapterLoader = async (signal: SignalsCodes | undefined = undefined, handle: Function | undefined = undefined) => {
      try {
        if (stdin.isRaw) {
          TerminalControl.exitRawMode(handle)
        }
        LOADER.start(loading_states.loading_chapter)

        if (signal === SignalsCodes.next_chapter)
          await chapterCtrl.nextChapter()
        else if (signal === SignalsCodes.previous_chapter)
          await chapterCtrl.prevChapter()

        let newPages = await chapterCtrl.loadChapter()
        chapterCtrl.historySave(mangaInfo.title, mangaInfo.src);
        pageCtrl.setPages(newPages ?? [])
        LOADER.stop()
        if (stdin.isTTY) TerminalControl.openRawMode(handle)
        renderInfo()
        await pageCtrl.loadPage()
      } catch (e) {
        LOADER.fail(err_messages.no_results.msg)
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
        TerminalControl.openRawMode(handleKeypress)
        if (!options?.target) {
          console.log(esc.clearViewport)
          renderInfo()
          await pageCtrl.loadPage()
          return
        }
        if (options.target === SignalsCodes.next_chapter)
          await chapterLoader(SignalsCodes.next_chapter, handleKeypress)
        else if (options.target === SignalsCodes.previous_chapter, handleKeypress)
          await chapterLoader(SignalsCodes.previous_chapter)
        else if (options.target === SignalsCodes.download_chapter) {
          const info = chapterCtrl.getChapterInfo()
          const pages = pageCtrl.getPages()
          TerminalControl.exitRawMode(handleKeypress)
          // await downloadChapter(mangaInfo.title, info.title as string, pages )
          TerminalControl.openRawMode(handleKeypress)
        }
        else if (options.target === SignalsCodes.get_chapters_list) {
          TerminalControl.exitRawMode(handleKeypress)
          const choices: Choice[] = chapters.map((e, index): Choice => ({ title: chapterCtrl.getChapterInfo().title ?? '', value: String(index) }))
          const chapterIndex = await prompts(chapterListPrompt(mangaInfo.title, chapterCtrl.geChapterIndex(), choices))
          if (!chapterIndex || !chapterIndex.target) return
          const targetChapter = chapters[Number(chapterIndex.target)]
          const lang = await askChapterLang(targetChapter)
          if (lang)
            chapterCtrl.setChapterLanguage(lang)
          chapterCtrl.setChapterIndex(Number(chapterIndex.target))
          chapterLoader(undefined, handleKeypress)
        }
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
