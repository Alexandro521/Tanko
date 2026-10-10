import ora from "ora"
import boxen, { type Options } from "boxen"
import ansi from "ansi-escapes"
import { memoryUsage, stdout } from "node:process"
import type { Key } from "node:readline"
import { downloadSection } from "./menu.ts"
import chalk, { type ColorName } from "chalk"
import { Notify } from "../functions/notify.ts"
import { MediaListStatus } from "../types/enum.ts"
import prompts  from "@alex_521/prompts"
import { Configuration } from "../functions/configuration.ts"
import { centerX, debounce, virtualWindow, slice} from "../utils.ts"
import { SignalsCodes } from "../types/enum.ts"
import { LocalTracker, TimeTracker, type LocalTrackerProps } from "../trackers/local.ts"
import { ChapterControl, PagesControl, TerminalControl } from "../functions/reader.ts"
import type { Chapter, HistoryObject2, LoadImageProps, MangaInfo, ObjectFit, Translations } from "../types/types.ts"
import { terminalReaderChapterOptions } from "./prompts.ts"
import supportsTerminalGraphics from "supports-terminal-graphics"
import { ChapterSelect } from "./components/chapterList.ts"
import {SqliteDB} from "../database/sqlite/sqlite.ts"

const LOADER = ora()
const CONFIGURATION = await Configuration.getInstance()
const localTracker = LocalTracker.getInstance()
const DB = await SqliteDB.getInstance()
let trackerAniList = CONFIGURATION.conf_session.getTracker('anilist')
let { err_messages, loading_states, reader } = await CONFIGURATION.getLanguageInterface()

CONFIGURATION.on('updatelanguage', (lang) => {
  err_messages = lang.err_messages
  loading_states = lang.loading_states
  reader = lang.reader
})

CONFIGURATION.on('login', (trackerName) => {
  trackerAniList = CONFIGURATION.conf_session.getTracker(trackerName)
})

export async function terminalReader(
  context: MangaInfo | HistoryObject2,
  chapters: Chapter[],
  startIndex: number,
  lang: Translations
){
  return new Promise<void>(async (resolve) => {
    const TIME_TRACKER = TimeTracker.getInstance<{manga_id: string, pages_read: number}>()
    let DEBUG_MODE = false
    let FULLSCREEN_MODE = false
    let IMGFITMODE:ObjectFit = CONFIGURATION.settings.reader_imgFit 
    let TOP_PADDING = 3
    let BOTTOM_PADDING = 1
    let IS_FIRST_RUN = true
    let RENDER_WSZ = {
      colums: stdout.columns,
      rows: stdout.rows
    }
    const CTX_FROM_HISTORY = 'pages_read' in context
    const mangaInfo =  CTX_FROM_HISTORY ? context.mangainfo : context
    let ANILIST_ID: number | undefined = mangaInfo.anilistId ? Number(mangaInfo.anilistId) : await trackerAniList.instance.getId(mangaInfo)
    mangaInfo.anilistId = ANILIST_ID
    const pagesCtl = new PagesControl();
    const mangaProvider = CONFIGURATION.conf_provider.providerInstance
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
        const chaptersCount = Math.max(chapters[0].number, chapters[chapters.length -1].number, chapters.length)
        const localTrackerProps: LocalTrackerProps = {
          chapterCount: chaptersCount,
          chapterIndex: chapterInfo.number,
          mangaId: mangaInfo.src
        }
        if (!(await localTracker.exists(localTrackerProps))) {
          await localTracker.regist(localTrackerProps)
        }
        const hasBeenRead = await localTracker.markAsRead(localTrackerProps)

        if (trackerAniList.isAuth && !hasBeenRead && typeof ANILIST_ID === 'number') {
          await trackerAniList.instance.track({
            mediaId: ANILIST_ID,
            lastRead: chapterInfo.number,
            progress: chapterInfo.number,
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
        position: imgPosition,
      })

      const imageLoaderAttr: LoadImageProps = {
        cotainerSize: imageContainer,
        invalidateCache,
        forceReload,
        maxImagePreloading: CONFIGURATION.settings.reader_maxImagePreloading,
        enableImgPreloading: CONFIGURATION.settings.reader_enableImgPreloading,
        imgPreloadingStrategy: CONFIGURATION.settings.reader_imgPreloadingStrategy,
        fit: IMGFITMODE,
        maxWidth: CONFIGURATION.settings.reader_maxImgWidth,
        position: {
          x: 'center',
          y: 'center',
        }
      }
      const x = centerX(loading_states.default_loading.length, stdout.columns)
      const y = (imgPosition.y + (imageContainer.w_rows >> 1))
      
      if(LOADER.isSpinning)
        LOADER.stop()
      
      LOADER.prefixText = ansi.cursorTo(imgPosition.x + x, y) + LOADER.prefixText
      if(!DEBUG_MODE)
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
      const forl = chapterCtl.isFirstOrLast()
      const forlStr = (forl < 0)  ? 'last' : (forl > 0) ? 'first' : 'none'
      const {
        rss,
        heapTotal, 
        heapUsed,
        external,
        arrayBuffers
      } = memoryUsage()

      const rows = [
        `cache hit:${cacheHit}:${cacheHit ? 'green' : 'red'}`,
        `Is it the first or the last? :${forlStr}:blue`,
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
      ]
      const memoryUse = [
        `Rss:${(rss/1024/1024).toFixed(2)}:MB`,
        `Heap Total:${(heapTotal/1024/1024).toFixed(2)}:MB`,
        `Heap Used:${(heapUsed/1024/1024).toFixed(2)}:MB`,
        `External:${(external/1024/1024).toFixed(2)}:MB`,
        `Array buffers:${(arrayBuffers/1024/1024).toFixed(2)}:MB`,
      ]
      const str = rows.map((e)=>{
        const s = e.split(':')
        const key =  chalk.yellow(s[0])
        const value = chalk[s[2] as ColorName](s[1])
        return `${key}:${value}`
      }).join('\n')
      const memoryUsedStr = memoryUse.map((e)=>{
        const s = e.split(':')
        const key =  chalk.yellowBright(s[0])
        const value = chalk.blueBright(s[1])
        return `${key}:${value} ${chalk.gray(s[2])}`
      }).join('\n')
      const boxOptions:Options = {
        borderStyle: 'single',
        borderColor: 'yellow',
        textAlignment: 'left',
        titleAlignment: 'center',
        padding: { left: 1, right: 1 },
        width: process.stdout.columns -4,
      }
      const box = boxen(str, {
        ...boxOptions,
        title: 'Debug Information',
        margin: {top: 1},
      }) 
      const box2 = boxen(memoryUsedStr, {
        ...boxOptions,
        borderStyle: {
          topLeft: '├',
          top: '─',
          topRight: '┤',
          right: '│',
          bottomRight: '┘',
          bottom: '─',
          bottomLeft: '└',
          left: '│',
        },
        title: 'Memory Usage',
        margin: {top: 0},
      })

      RENDER_WSZ.rows = (stdout.rows - (rows.length + memoryUse.length) -4)
      process.stdout.write(box + '\r')
      process.stdout.write(box2)
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

      process.stdout.write(`${ansi.cursorForward(titleCenter)}${mangaTitle}\n`)
      process.stdout.write(`${ansi.cursorForward(chapterTitleCenter)}${chapterTitle}\n`)
      process.stdout.write(`${ansi.cursorForward(centerStats)}${stats}\n`)
    }

    const renderFooter = ()=>{
      const SHORTCUTS = [
      ['⥄', 'Move'],
      ['P', 'Previous'],
      ['N', 'Next'],
      ['C', 'Options'],
      ['F', 'Max/Min'],
      ['M', 'Toggle fit'],
      ['R', 'Reload page'],
      ['Shift+R', 'Redraw page'],
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
        ansi.cursorSavePosition + 
        ansi.cursorTo(x, stdout.rows) +
        str +
        ansi.cursorRestorePosition
      )
    }

    const saveInHistory = ()=>{
      const chapterInfo = chapterCtl.getChapterInfo()
      const historyEntry: HistoryObject2 = {
        chapter_index: chapterCtl.geChapterIndex(),
        chapter_src: chapterInfo.chapterTarget.id,
        lang_iso: chapterInfo.chapterTarget.lang,
        page_index: pagesCtl.index,
        pages_read: pagesCtl.readPages,
        read_progress: pagesCtl.readProgress,
        sort_order: "desc",
        provider: mangaProvider.name,
        chapter_title: chapterInfo.chapterTarget.title,
        mangainfo: mangaInfo,
      }
      DB.insertOnHistory(historyEntry)
    }
    const render = async (invalidateCache=false, forceReload=false) => {
      if (!process.stdin.isRaw) return;
      process.stdout.write(ansi.clearScreen)
      if (!FULLSCREEN_MODE && IMGFITMODE !== 'cover') {
        renderHeader()
        if (DEBUG_MODE) debugModeRendeer()
        renderFooter()
    }
      await pageRender(invalidateCache, forceReload)
    }

    const chapterLoader = async (action: SignalsCodes | undefined = undefined, force = false) => {
      try {
        process.stdout.write(ansi.clearTerminal)
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
          /**
           * The pages_read field is always zero
           *  when the current chapter is added to the time_tracker stack,
           *  so we remove it from the stack and overwrite that value
           *  with the current pages_read before loading a new chapter.
           */
          if(!IS_FIRST_RUN){
            const current = TIME_TRACKER.get('manga_reader')
            if(current){
              current.payload.pages_read = pagesCtl.readPages
              TIME_TRACKER._overrideTop('manga_reader', current)
            }
          }
          const chapterInfo = chapterCtl.getChapterInfo()
          const newPages = await chapterCtl.loadChapter()
          pagesCtl.setPages(newPages ?? [])
          if(CTX_FROM_HISTORY && IS_FIRST_RUN){
            pagesCtl.setIndex(context.page_index)
            pagesCtl.setProgress(context.pages_read)
          }
          saveInHistory()
          /**
           * Run after saving to history to ensure
           * that the record corresponding to the mangaInfo object's ID exists in the database.
           * This creates a dependency on this function, but let's trust it.
           */
          TIME_TRACKER.track('manga_reader', chapterInfo.chapterTarget.id, {
            manga_id: mangaInfo.src,
            pages_read: pagesCtl.readPages
          })
        }
        if (LOADER.isSpinning)
          LOADER.stop()
        if (process.stdin.isTTY)
          TerminalControl.openRawMode(keyPressHandle)
        await render()
        } catch (e) {
        if(LOADER.isSpinning) LOADER.stop()
        if (process.stdin.isRaw)
          TerminalControl.exitRawMode(keyPressHandle)
        if (e instanceof Error) {
          Notify.pushError(e)
        }
        process.stdout.write(ansi.cursorShow)
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
        saveInHistory()
        /**
         * This code is a copy of the one already shown in the chapterLoader function,
         *  and it fulfills the same objective as the previous one,
         *  overwriting the value of the last chapter read before saving.
         */
        const current = TIME_TRACKER.get('manga_reader')
        if (current) {
          current.payload.pages_read = pagesCtl.readPages
          TIME_TRACKER._overrideTop('manga_reader', current)
        }
        const readStack = TIME_TRACKER.stop('manga_reader')
        TIME_TRACKER.drop('manga_reader')
        if(readStack){
          DB.insertOnSessionTracker(readStack)
        }
        
        process.removeListener('SIGWINCH', SIGWINCH_HANDLER)
        process.stdout.write(ansi.cursorShow)
        TerminalControl.exitRawMode(keyPressHandle);
        if (key.ctrl && keyName === 'c') {
          await CONFIGURATION.conf_browser.close()
          await CONFIGURATION.store()
          pagesCtl.reset()
          stdout.write(
            ansi.clearTerminal +
            ansi.exitAlternativeScreen
          );
          process.exit(0)
        }
        process.stdout.write(ansi.clearScreen)
        pagesCtl.reset()
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
          await render(false, true)
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
      else if(keyName === 'm'){
        IMGFITMODE = IMGFITMODE === 'contain' ? 'cover' : 'contain'
        await render(false, true)
      }
      else if (keyName === 'c') {
        process.stdout.write(ansi.clearViewport)
        process.stdout.write(ansi.cursorShow)
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
          let outputStatus = -1
          await ChapterSelect(mangaProvider, mangaInfo, chapters, async (e, stop)=>{
            const {chapterLanguage, chapterIndex} = e
            chapterCtl.setChapterLanguage(chapterLanguage)
            chapterCtl.setChapterIndex(chapterIndex)
            outputStatus = 1
            stop()
          })
          if(outputStatus < 0){
            TerminalControl.openRawMode(keyPressHandle)
            await render()
            return
          }else {
            await chapterLoader(undefined, true)
            //await render()
          }
        }
        else if (optionsPrompt.target === SignalsCodes.exit) {
          process.stdout.write(ansi.clearViewport)
          process.removeListener('SIGWINCH', SIGWINCH_HANDLER)
          resolve()
        }
      }
    }

    process.stdout.write(ansi.cursorHide)
    process.on('SIGWINCH', SIGWINCH_HANDLER)
    await chapterLoader(undefined, true);
    IS_FIRST_RUN = false
  })
}
