import ora from "ora"
import boxen from "boxen"
import ansiEsc from "ansi-escapes"
import { stdout } from "node:process"
import type { Key } from "node:readline"
import { downloadSection } from "./menu.ts"
import chalk, { Chalk, type ColorName } from "chalk"
import { Notify } from "../functions/notify.ts"
import { MediaListStatus } from "../types/enum.ts"
import prompts, { type Choice } from "@alex_521/prompts"
import { Configuration } from "../functions/configuration.ts"
import { centerX, debounce, virtualWindow, slice} from "../utils.ts"
import { SignalsCodes, ConfigurationEvents } from "../types/enum.ts"
import { LocalTracker, type LocalTrackerProps } from "../trackers/local.ts"
import { ChapterControl, PagesControl, TerminalControl } from "../functions/reader.ts"
import type { Chapter, LoadImageProps, MangaInfo, Translations } from "../types/types.ts"
import { askChapterLang, chapterListPrompt, terminalReaderChapterOptions } from "./prompts.ts"
import supportsTerminalGraphics from "supports-terminal-graphics"

const LOADER = ora()
const CONFIGURATION = await Configuration.getInstance()
const localTracker = LocalTracker.getInstance()

let trackerAniList = CONFIGURATION.getTracker('anilist')
let { err_messages, loading_states, reader } = await CONFIGURATION.getLanguageInterface()

CONFIGURATION.on(ConfigurationEvents.updateLanguage, (lang) => {
  err_messages = lang.err_messages
  loading_states = lang.loading_states
  reader = lang.reader
})

CONFIGURATION.on(ConfigurationEvents.login, () => {
  trackerAniList = CONFIGURATION.getTracker('anilist')
})

export async function terminalReader(
  mangaInfo: MangaInfo,
  chapters: Chapter[],
  startIndex: number,
  lang: Translations
){
  return new Promise<void>(async (resolve) => {
    let DEBUG_MODE = false
    let FULLSCREEN_MODE = false
    let TOP_PADDING = 3
    let BOTTOM_PADDING = 1
    let RENDER_WSZ = {
      colums: stdout.columns,
      rows: stdout.rows
    }
    let ANILIST_ID: number | undefined = mangaInfo?.anilistId ? 
    Number(mangaInfo.anilistId) : await trackerAniList.instance.getId(mangaInfo)
    
    const pagesCtl = new PagesControl([]);
    const mangaProvider = CONFIGURATION.getServer()
    const chapterCtl = new ChapterControl(chapters, startIndex, lang, mangaProvider);
    
    const SIGWINCH_HANDLER = async () => {
      RENDER_WSZ.colums = stdout.columns
      RENDER_WSZ.rows = stdout.rows
      if(TerminalControl.isRaw){
        const $ = supportsTerminalGraphics.stdout
        if(!$.kitty && !$.iterm2){
          await render(true, false)
        }else{
          await render()
        }
      }
    }

    const trackerCtl = async () => {
      if (pagesCtl.readProgress >= 75 && !chapterCtl.hasBeenTracked) {
        const chapterInfo = chapterCtl.getChapterInfo()
        const localTrackerProps: LocalTrackerProps = {
          chapterCount: chapters.length,
          chapterIndex: chapterInfo.chapter,
          mangaId: mangaInfo.src
        }
        if (!(await localTracker.exists(localTrackerProps))) {
          await localTracker.regist(localTrackerProps)
        }
        const hasBeenRead = await localTracker.markAsRead(localTrackerProps)

        if (trackerAniList.isAuth && !hasBeenRead && ANILIST_ID) {
          await trackerAniList.instance.track({
            mediaId: ANILIST_ID,
            lastRead: chapterInfo.chapter,
            progress: chapterInfo.chapter,
            status: MediaListStatus.Current,
          })
          chapterCtl.hasBeenTracked = true
        }
      }
    }

    const pageRender = debounce(async (invalidateCache=false, forceReload=false) => {
      const imgPosition = {
        y: FULLSCREEN_MODE ? 0 : (stdout.rows - RENDER_WSZ.rows) + (TOP_PADDING), 
        x: FULLSCREEN_MODE ? 0 : stdout.columns - RENDER_WSZ.colums 
      }

      const imageContainer = virtualWindow({
        cellPxHeigth: TerminalControl.wsz.w_cellPxHeight,
        cellPxWidth: TerminalControl.wsz.w_cellPxWidth,
        columns: FULLSCREEN_MODE ? stdout.columns : RENDER_WSZ.colums,
        rows: FULLSCREEN_MODE ? stdout.rows :  RENDER_WSZ.rows - (TOP_PADDING + BOTTOM_PADDING),
        position: imgPosition
      })

      const imageLoaderAttr: LoadImageProps = {
        cotainerSize: imageContainer,
        invalidateCache,
        forceReload,
        position: {
          x: 'center',
          y: 'center',
        }
      }
      const x = centerX(loading_states.default_loading.length, stdout.columns)
      const y = (imgPosition.y + (imageContainer.w_rows >> 1) )
      LOADER.prefixText = ansiEsc.cursorTo(imgPosition.x + x, y) + LOADER.prefixText

      if(!LOADER.isSpinning)
        LOADER.start(loading_states.default_loading)

      await pagesCtl.loadPage(imageLoaderAttr)

      if(LOADER.isSpinning)
        LOADER.stop()

      pagesCtl.render()
      await trackerCtl()
    }, 300)

    const debugModeRendeer = async () => {
      const pages = pagesCtl.getPages()
      const index = pagesCtl.index
      const cacheHit= pagesCtl.imageLoader.cacheHit(pages[index])
      const cacheStats = pagesCtl.imageLoader.getStats()
      const wsz = TerminalControl.wsz
      const rows = [
        `cache hit:${cacheHit}:${cacheHit ? 'green' : 'red'}`,
        `is last or first:${chapterCtl.isFirstOrLast()}:blue`,
        `cache alloc size:${cacheStats.size} MB:yellow`,
        `cache length:${pagesCtl.imageLoader.size}:green`,
        `chapters length:${chapters.length}:gray`,
        `chapter index:${chapterCtl.geChapterIndex()}:gray`,
        `image protocol:${TerminalControl.graphicalProtocol}:blue`,
        `window width:${wsz.w_width}:blue`,
        `window height:${wsz.w_height}:blue`,
        `window colums:${wsz.w_colums}:blue`,
        `window rows:${wsz.w_rows}:blue`,
        `window cell width:${wsz.w_cellPxWidth}:blue`,
        `window cell height:${wsz.w_cellPxHeight}:blue`,
        `window ratio:${wsz.w_ratio}:blue`,
        `shared memory:${(process.resourceUsage()).sharedMemorySize}:yellow`,
      ]

      const str = rows.map((e)=>{
        const s = e.split(':')
        const key =  chalk.yellow(s[0])
        const value = chalk[s[2] as ColorName](s[1])
        return `${key}:${value}`
      }).join('\n')

      const box = boxen(str, {
        borderStyle: 'single',
        title: 'Debug Information',
        borderColor: 'yellow',
        textAlignment: 'left',
        titleAlignment: 'center',
        width: process.stdout.columns -4,
        margin: {top: 1},
        padding: { left: 1, right: 1 }
      })
      RENDER_WSZ.rows = (stdout.rows - rows.length -3)
      process.stdout.write(box)
    }

    const renderHeader = ()=>{
      const chapterInfo = chapterCtl.getChapterInfo()
      const chapterTitle =  slice(chapterInfo.title ?? '', stdout.columns)
      const mangaTitle = slice(mangaInfo.title, stdout.columns)
      const stats =slice([
        `${pagesCtl.index+1}/${pagesCtl.PagesLength}`,
        `${pagesCtl.readProgress.toFixed(1) }%`,
        `${ANILIST_ID}`
      ].join(" ⏺ "), stdout.columns)

      const centerStats = centerX(stats.length, process.stdout.columns)
      const titleCenter = centerX(mangaInfo.title.length, process.stdout.columns)
      const chapterTitleCenter = centerX(chapterTitle.length, process.stdout.columns)

      process.stdout.write(`${ansiEsc.cursorForward(titleCenter)}${mangaTitle}\n`)
      process.stdout.write(`${ansiEsc.cursorForward(chapterTitleCenter)}${chapterTitle}\n`)
      process.stdout.write(`${ansiEsc.cursorForward(centerStats)}${stats}\n`)
    }

    const renderFooter = ()=>{
      const SHORTCUTS = [
      ['⥄', 'Move'],
      ['P', 'Previous'],
      ['N', 'Next'],
      ['C', 'Options'],
      ['F', 'Max/Min'],
      ['R', 'Reload page'],
      ['\u{21E7}R', 'Redraw page'],
      ['^R', 'Reload chapter'],
      ['F12', 'Debug on/off'],
      ['Esc/Q', 'Exit'],
    ]
      let str = ''
      let strlength = 0
      let i = 0
      while(i < SHORTCUTS.length){
        const tokens = SHORTCUTS[i]
        const [key, value] = tokens
        const length = strlength + key.length + value.length + 4 //-> white space
        if(length < stdout.columns){
          str += `${chalk.bgWhite(` ${chalk.black(key)} `)} ${value} `
          strlength = length
        }
        i++
      }
      const x = centerX(strlength, stdout.columns)
      process.stdout.write(
        ansiEsc.cursorSavePosition + 
        ansiEsc.cursorTo(x, stdout.rows) +
        str +
        ansiEsc.cursorRestorePosition
      )
    }

    const render = async (invalidateCache=false, forceReload=false) => {
      if (!process.stdin.isRaw) return;
      process.stdout.write(ansiEsc.clearViewport + ansiEsc.cursorHide)
      if (!FULLSCREEN_MODE) {
        renderHeader()
        if (DEBUG_MODE) debugModeRendeer()
        renderFooter()
      }
      await pageRender(invalidateCache, forceReload)
    }

    const chapterLoader = async (action: SignalsCodes | undefined = undefined, force = false) => {
      try {
        LOADER.start(loading_states.loading_chapter)
        let isFirstOrLast = chapterCtl.isFirstOrLast()

        switch (action) {
          case SignalsCodes.next_chapter:
            if (isFirstOrLast === 1) {
              isFirstOrLast = 0;
            }
            await chapterCtl.nextChapter()
            break
          case SignalsCodes.previous_chapter:
            if (isFirstOrLast === -1) {
              isFirstOrLast = 0
            }
            await chapterCtl.prevChapter()
            break
        }

        if (isFirstOrLast === 0 || force) {
          const newPages = await chapterCtl.loadChapter()
          chapterCtl.historySave(mangaInfo.title, mangaInfo.src, mangaProvider.name);
          pagesCtl.setPages(newPages ?? [])
        }
        if (LOADER.isSpinning)
          LOADER.stop()

        if (process.stdin.isTTY)
          TerminalControl.openRawMode(keyPressHandle)
        await render()
      } catch (e) {
        if (process.stdin.isRaw)
          TerminalControl.exitRawMode(keyPressHandle)
        if (e instanceof Error)
          Notify.pushError(e)
        process.stdout.write(ansiEsc.cursorShow)
        resolve()
      }
    }

    const keyPressHandle = async (__: string, key: Key) => {
      const keyName = key.name;
      const keyctrl = key.ctrl
      const keyshift = key.shift
      const keymeta = key.meta
      const keyEsc = key?.sequence === '\x1B'

      if ((keyctrl && keyName === 'c') || keyName === 'q' || keyEsc) {
        process.removeListener('SIGWINCH', SIGWINCH_HANDLER)
        process.stdout.write(ansiEsc.cursorShow)
        TerminalControl.exitRawMode(keyPressHandle);
        if (key.ctrl && keyName === 'c') {
          await CONFIGURATION.closeBrowser()
          await CONFIGURATION.writeConfigFile()
          process.exit(0)
        }
        resolve();
      } 
      else if (keyName === 'left' || keyName === 'right') {
        if (keyName.startsWith('l')) pagesCtl.backPage()
        else pagesCtl.nextPage()
        await render()
        return
      }
      else if (keyName === 'p'){
        await chapterLoader(SignalsCodes.previous_chapter)
        return
      }
      else if (keyName === 'n'){
        await chapterLoader(SignalsCodes.next_chapter)
        return
      }
      else if (keyName === 'f') {
        FULLSCREEN_MODE = !FULLSCREEN_MODE
        const $ = supportsTerminalGraphics.stdout
        if(!$.kitty && !$.iterm2){
          await render(false, false)
        }else{
          await render()
        }
        return
      }
      else if (keyName === 'f12') {
        DEBUG_MODE = !DEBUG_MODE
        if (!DEBUG_MODE) {
          RENDER_WSZ.rows = stdout.rows
        }
        await render()
        return
      }
      else if (keyName === 'r'){
        if(keyctrl){
          pagesCtl.reset()
          await chapterLoader(undefined, true)
        }else if (keyshift){
          await render(false, true)
        }else {
          await render(true, true)
        }
      }
      else if (keyName === 'c') {
        process.stdout.write(ansiEsc.clearViewport)
        process.stdout.write(ansiEsc.cursorShow)
        TerminalControl.exitRawMode(keyPressHandle)

        const optionsPrompt = await prompts(terminalReaderChapterOptions())
        if (!optionsPrompt?.target) {
          TerminalControl.openRawMode(keyPressHandle)
          await render()
          return
        }
        if (optionsPrompt.target === SignalsCodes.next_chapter)
          await chapterLoader(SignalsCodes.next_chapter)
        else if (optionsPrompt.target === SignalsCodes.previous_chapter)
          await chapterLoader(SignalsCodes.previous_chapter)
        else if (optionsPrompt.target === SignalsCodes.download_chapter) {
          await downloadSection(mangaInfo, chapters, chapterCtl.geChapterIndex(), chapterCtl.getLang(), mangaProvider)
          TerminalControl.openRawMode(keyPressHandle)
          await render()
          return
        }
        else if (optionsPrompt.target === SignalsCodes.get_chapters_list) {
          const languageTarget = chapterCtl.getLang()
          const choices: Choice[] = chapters.map((e, index): Choice => {
            const target = chapterCtl.extractChapterSrcByLang(e, languageTarget)
            const props = {
              title: target.title,
              value: String(index)
            }
            return props
          })
          const chapterIndex = await prompts(
            chapterListPrompt(mangaInfo.title, chapterCtl.geChapterIndex(), choices)
          )
          if (!chapterIndex || !chapterIndex.target) {
            TerminalControl.openRawMode(keyPressHandle)
            await render()
            return
          }
          const targetChapter = chapters[Number(chapterIndex.target)]
          const lang = await askChapterLang(targetChapter) ?? languageTarget
          chapterCtl.setChapterLanguage(lang)
          chapterCtl.setChapterIndex(Number(chapterIndex.target))
          await chapterLoader(undefined, true)
        }
        else if (optionsPrompt.target === SignalsCodes.exit) {
          process.stdout.write(ansiEsc.clearViewport)
          process.removeListener('SIGWINCH', SIGWINCH_HANDLER)
          resolve()
        }
      }
    }

    process.stdout.write(ansiEsc.cursorHide)
    process.on('SIGWINCH', SIGWINCH_HANDLER)
    await chapterLoader(undefined, true);
  })
}
