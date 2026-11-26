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
import { centerX, debounce, virtualWindow, slice, ObjectDiff} from "../utils.ts"
import { SignalsCodes } from "../types/enum.ts"
import { LocalTracker, TimeTracker, type LocalTrackerProps } from "../trackers/local.ts"
import { ChapterControl, PagesControl, TerminalControl } from "../functions/reader.ts"
import type { Chapter, HistoryObject2, LoadImageProps, MangaInfo, ObjectFit, StructImgPosition, Translations, WSZ } from "../types/types.ts"
import { addToUserListPrompt, terminalReaderChapterOptions } from "./prompts.ts"
import supportsTerminalGraphics from "supports-terminal-graphics"
import { ChapterSelect } from "./components/chapterList.ts"
import {SqliteDB} from "../database/sqlite/sqlite.ts"
import EventEmitter from "node:events"
import { getIi8n } from "../functions/lang.ts"

interface RenderProps {
  invalidateCache: boolean, 
  forceReload: boolean
  position: StructImgPosition
  window: {
    position: {
      x: number,
      y: number
    },
    size: {
      x: number,
      y: number
    }
  }
}

interface RenderRequest {
  pageIndex: number,
  chapterIndex: number,
  flags: ControlFlags
  wsz: WSZ
}

type ReaderEvent = {
  'render': [snapshot: RenderRequest]
  'chapterLoad': []
  'error': []
  'exit': []
  'options': []
}

interface ReaderProps  {
  context: MangaInfo | HistoryObject2,
  chapters: Chapter[],
  startIndex: number,
  lang: Translations
}
interface ControlFlags {
  DEBUG: boolean
  ACTION_LOCK: boolean
  FULLSCREEN: boolean
  FIT_MODE: ObjectFit
  IS_FIRST_RUN: boolean
}
const LOADER = ora()
const CONFIGURATION = await Configuration.getInstance()
const DATABASE = await SqliteDB.getInstance()
const LOCAL_TRACKER = LocalTracker.getInstance()
const TIME_TRACKER = TimeTracker.getInstance<{manga_id: string, pages_read: number}>()
let ANILIST_TRACKER = CONFIGURATION.conf_session.getTracker('anilist')
let I18N = getIi8n(await CONFIGURATION.getLanguageInterface())
const EVENT = new EventEmitter<ReaderEvent>()

CONFIGURATION.on('updatelanguage', (lang) => {
  I18N = getIi8n(lang)
})

CONFIGURATION.on('login', (trackerName) => {
  ANILIST_TRACKER = CONFIGURATION.conf_session.getTracker(trackerName)
})

export async function terminalReader(props: ReaderProps){
  return new Promise<void>(async (resolve) => {
    const CTL_FLAGS: ControlFlags = {
      ACTION_LOCK: false,
      DEBUG: false,
      FULLSCREEN: false,
      IS_FIRST_RUN: true,
      FIT_MODE: CONFIGURATION.settings.reader_imgFit,
    }

    const FROM_HISTORY = 'chapter_src' in props.context
    const MANGA_INFO =  FROM_HISTORY ? (<HistoryObject2> props.context ).mangainfo : <MangaInfo>props.context
    let ANILIST_ID;

    if(typeof MANGA_INFO.anilistId === 'string' && MANGA_INFO.anilistId.length > 0){
      ANILIST_ID = parseInt(MANGA_INFO.anilistId) 
      MANGA_INFO.anilistId = ANILIST_ID
    } else{
      ANILIST_ID = await ANILIST_TRACKER.instance.getId(MANGA_INFO)
      MANGA_INFO.anilistId = ANILIST_ID
    } 

    const mangaProvider = CONFIGURATION.conf_provider.providerInstance
    const pagesController = new PagesControl();
    const chapterController = new ChapterControl(props.chapters, props.startIndex, props.lang, mangaProvider);

    const SIGWINCH_HANDLER = async () => {
      if(TerminalControl.isRaw){
        const gph = supportsTerminalGraphics.stdout
        if(gph.kitty || gph.iterm2){
          await render()
        }else{
          await render(true, false)
        }
      }
    }

    EVENT.on('render', (snapShot)=>{
      if (LOADER.isSpinning)
          LOADER.stop()
      const chapterIndex = chapterController.geChapterIndex()
      const pageIndex = pagesController.index
      if(snapShot.chapterIndex === chapterIndex && snapShot.pageIndex === pageIndex){
        const flagDiff = ObjectDiff(CTL_FLAGS, snapShot.flags)
        if(flagDiff === 0 && snapShot.wsz.w_rows === stdout.rows && snapShot.wsz.w_colums === stdout.columns){
          pagesController.renderPage(pageIndex)
          trackerController()
        }
      }
    })

    const trackerController = async () => {
      if (pagesController.readProgress >= 75 && !chapterController.hasBeenTracked) {
        const ch = props.chapters
        const chapterInfo = chapterController.getChapterInfo()
        const chaptersCount = Math.max(ch[0].number, ch[props.chapters.length -1].number, ch.length)

        const localTrackerProps: LocalTrackerProps = {
          chapterCount: chaptersCount,
          chapterIndex: chapterInfo.number,
          mangaId: MANGA_INFO.src
        }

        if (!(await LOCAL_TRACKER.exists(localTrackerProps))) {
          await LOCAL_TRACKER.regist(localTrackerProps)
        }
        const mark = LOCAL_TRACKER.markAsRead(localTrackerProps)
        if (ANILIST_TRACKER.isAuth && typeof ANILIST_ID === 'number') {
          await ANILIST_TRACKER.instance.track({
            mediaId: ANILIST_ID,
            lastRead: chapterInfo.number,
            progress: chapterInfo.number,
            status: MediaListStatus.Current,
          })
          await mark;
          chapterController.hasBeenTracked = true
        }
      }
    }

    const loadPage = debounce<RenderProps>(
      async (props: RenderProps ) => {
        const wsz = virtualWindow({
          cellPxHeigth: TerminalControl.wsz.w_cellPxHeight,
          cellPxWidth: TerminalControl.wsz.w_cellPxWidth,
          columns: props.window.size.x,
          rows: props.window.size.y,
          position: props.window.position,
        })

        const imageLoaderAttr: LoadImageProps = {
          wsz: wsz,
          invalidateCache: props.invalidateCache,
          forceReload: props.forceReload,
          forceProtocol: CONFIGURATION.settings.reader_forceImgProtocol,
          forceAscii: CONFIGURATION.settings.reader_forceAscii,
          maxImagePreloading: CONFIGURATION.settings.reader_maxImagePreloading,
          enableImgPreloading: CONFIGURATION.settings.reader_enableImgPreloading,
          imgPreloadingStrategy: CONFIGURATION.settings.reader_imgPreloadingStrategy,
          maxImgWidth: CONFIGURATION.settings.reader_maxImgWidth,
          imageFit: CTL_FLAGS.FIT_MODE,
          position:  props.position
        }
        if (LOADER.isSpinning)
          LOADER.stop()

        const spinnerPosition = {
          y: props.window.position.y + Math.floor(props.window.size.y / 2 ),
          x: centerX(I18N.i18nLoadings.default_loading.length ,stdout.columns)
        }
        LOADER.prefixText = ansi.cursorTo(spinnerPosition.x, spinnerPosition.y)
        LOADER.start(I18N.i18nLoadings.default_loading)
        
        const snapShot: RenderRequest = {
          pageIndex: pagesController.index,
          chapterIndex: chapterController.geChapterIndex(),
          flags: CTL_FLAGS,
          wsz: {
            w_colums: stdout.columns, 
            w_rows: stdout.rows,
            w_height: 0,
            w_width: 0,
            w_cellPxWidth: 0,
            w_cellPxHeight: 0,
            w_ratio: 0,
            w_position_x: 0,
            w_position_y: 0
          }
        }
        pagesController.loadPage(imageLoaderAttr, CONFIGURATION.conf_provider.provider.customHeaders)
          .then(() => {
            EVENT.emit('render', snapShot)
          })
          .catch((e) => {
            if (e instanceof Error) {
              Notify.pushError(e)
            }
          })
    }, 300)

    const debugRender = () => {
      const pages = pagesController.getPages()
      const index = pagesController.index
      const cacheHit= pagesController.storageHit(pages[index])
      const storageSize = pagesController.imgStorage.storage.byteLength / 1024 / 1024
      const storaMaxSize = pagesController.imgStorage.storage.constrains.maxByteLength / 1024 / 1024
      const wsz = TerminalControl.wsz
      const forl = chapterController.isFirstOrLast()
      const forlStr = (forl < 0)  ? 'last' : (forl > 0) ? 'first' : 'none'
      const {
        rss,
        heapTotal, 
        heapUsed,
        external,
        arrayBuffers
      } = memoryUsage()

      const rows = [
        `Is it the first or the last? :${forlStr}:blueBright`,
        `storage hit:${cacheHit}:${cacheHit ? 'green' : 'red'}`,
        `image storage size:${storageSize.toFixed(1)} MB:blueBright`,
        `image storage max size:${storaMaxSize.toFixed(1)} MB:blueBright`,
        `image storage length:${pagesController.imgStorage.storage.size}:blueBright`,
        `chapters length:${props.chapters.length}:blue`,
        `chapter index:${chapterController.geChapterIndex()}:blue`,
        `image protocol:${CONFIGURATION.settings.reader_forceImgProtocol}:blueBright`,
        `window width:${wsz.w_width}:blueBright`,
        `window height:${wsz.w_height}:blueBright`,
        `window colums:${wsz.w_colums}:blueBright`,
        `window rows:${wsz.w_rows}:blueBright`,
        `window cell width:${wsz.w_cellPxWidth}:blueBright`,
        `window cell height:${wsz.w_cellPxHeight}:blueBright`,
        `window ratio:${wsz.w_ratio}:blueBright`,
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
        const key =  chalk.yellowBright(s[0])
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
      process.stdout.write(box + '\r')
      process.stdout.write(box2)
      return rows.length + memoryUse.length + 4
    }

    const renderHeader = ()=>{
      const chapterInfo = chapterController.getChapterInfo()
      const chapterTitle =  slice(chapterInfo.title ?? '', stdout.columns)
      const mangaTitle = slice(MANGA_INFO.title, stdout.columns)
      const stats =slice([
        `${pagesController.index+1}/${pagesController.PagesLength}`,
        `${pagesController.readProgress.toFixed(1)}%`,
        `${ANILIST_ID}`
      ].join(" ⏺ "), stdout.columns)

      const centerStats = centerX(stats.length, process.stdout.columns)
      const titleCenter = centerX(MANGA_INFO.title.length, process.stdout.columns)
      const chapterTitleCenter = centerX(chapterTitle.length, process.stdout.columns)

      process.stdout.write(`${ansi.cursorForward(titleCenter)}${mangaTitle}\n`)
      process.stdout.write(`${ansi.cursorForward(chapterTitleCenter)}${chapterTitle}\n`)
      process.stdout.write(`${ansi.cursorForward(centerStats)}${stats}\n`)
      return 3
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
      let output = ''
      let outputLength = 0
      const whiteSpaces = 4
      for (let i = 0; i < SHORTCUTS.length; i++) {
        const [key, label] = SHORTCUTS[i]
        const newLength = outputLength + key.length + label.length + whiteSpaces
        if (newLength <= stdout.columns) {
          output += `${chalk.bgWhite(` ${chalk.black(key)} `)} ${label} `
          outputLength = newLength
        }
      }
      const x = centerX(outputLength, stdout.columns)
      process.stdout.write(
        ansi.cursorSavePosition + 
        ansi.cursorTo(x, stdout.rows) +
        output +
        ansi.cursorRestorePosition
      )
      return 1
    }

    const saveInHistory = ()=>{
      const chapterInfo = chapterController.getChapterInfo()
      const historyEntry: HistoryObject2 = {
        chapter_index: chapterController.geChapterIndex(),
        chapter_src: chapterInfo.chapterTarget.id,
        lang_iso: chapterInfo.chapterTarget.lang,
        page_index: pagesController.index,
        pages_read: pagesController.readPages,
        read_progress: pagesController.readProgress,
        sort_order: "desc",
        provider: mangaProvider.name,
        chapter_title: chapterInfo.chapterTarget.title,
        mangainfo: MANGA_INFO,
      }
      DATABASE.insertOnHistory(historyEntry)
    }
    
    const render = async (invalidateCache = false, forceReload = false) => {
      if (LOADER.isSpinning)
        LOADER.stop()
      if (process.stdin.isRaw) {
        process.stdout.write(ansi.clearViewport)
        const margin = {top: 0, bottom: 0}
        if(CTL_FLAGS.FIT_MODE === 'contain' && !CTL_FLAGS.FULLSCREEN){
          margin.top += renderHeader()
          if (CTL_FLAGS.DEBUG) 
            margin.top+= debugRender() + 1 
          margin.bottom+= renderFooter()
        }
        const renderProps: RenderProps = {
          forceReload,
          invalidateCache,
          position: { x: 'center', y: 'center' },
          window: {
            size: {
              y: stdout.rows - (margin.top + margin.bottom),
              x: stdout.columns
            },
            position: {
              x: 0,
              y: margin.top
            }
          }
        }
        await loadPage(renderProps)
      }
    }

    const chapterLoader = async (action: SignalsCodes | undefined = undefined, force = false) => {
      try {
        process.stdout.write(ansi.clearViewport)
        LOADER.start(I18N.i18nLoadings.loading_chapter)
        let isFirstOrLast = chapterController.isFirstOrLast()
        switch (action) {
          case SignalsCodes.next_chapter:
            if (isFirstOrLast === 1) {
              isFirstOrLast = 0
            }
            await chapterController.nextChapter()
            break
          case SignalsCodes.previous_chapter:
            if (isFirstOrLast === -1) {
              isFirstOrLast = 0
            }
            await chapterController.prevChapter()
            break
        }
        if (isFirstOrLast === 0 || force) {
          /**
           * The pages_read field is always zero
           *  when the current chapter is added to the time_tracker stack,
           *  so we remove it from the stack and overwrite that value
           *  with the current pages_read before loading a new chapter.
           */
          if(!CTL_FLAGS.IS_FIRST_RUN){
            const current = TIME_TRACKER.get('manga_reader')
            if(current){
              current.payload.pages_read = pagesController.readPages
              TIME_TRACKER._overrideTop('manga_reader', current)
            }
          }
          const chapterInfo = chapterController.getChapterInfo()
          const newPages = await chapterController.loadChapter()
          pagesController.setPages(newPages ?? [])
          if(FROM_HISTORY && CTL_FLAGS.IS_FIRST_RUN){
            const ctx = props.context as HistoryObject2
            pagesController.setIndex(ctx.page_index)
            pagesController.setProgress(ctx.pages_read)
          }
          saveInHistory()
          /**
           * Run after saving to history to ensure
           * that the record corresponding to the mangaInfo object's ID exists in the database.
           * This creates a dependency on this function, but let's trust it.
           */
          TIME_TRACKER.track('manga_reader', chapterInfo.chapterTarget.id, {
            manga_id: MANGA_INFO.src,
            pages_read: pagesController.readPages
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
          current.payload.pages_read = pagesController.readPages
          TIME_TRACKER._overrideTop('manga_reader', current)
        }
        const readStack = TIME_TRACKER.stop('manga_reader')
        TIME_TRACKER.drop('manga_reader')
        if(readStack){
          DATABASE.insertOnSessionTracker(readStack)
        }
        
        process.removeListener('SIGWINCH', SIGWINCH_HANDLER)
        process.stdout.write(ansi.cursorShow)
        TerminalControl.exitRawMode(keyPressHandle);
        if (key.ctrl && keyName === 'c') {
          await CONFIGURATION.conf_browser.close()
          await CONFIGURATION.store()
          pagesController.reset()
          stdout.write(
            ansi.clearTerminal +
            ansi.exitAlternativeScreen
          );
          process.exit(0)
        }
        process.stdout.write(ansi.clearViewport)
        pagesController.reset()
        pagesController.free()
        resolve();
      } 
      else if (keyName === 'left' || keyName === 'right') {
        if (keyName.startsWith('l')) pagesController.backPage()
        else pagesController.nextPage()
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
        CTL_FLAGS.FULLSCREEN = !CTL_FLAGS.FULLSCREEN
        const $ = supportsTerminalGraphics.stdout
        if(!$.kitty && !$.iterm2){
          await render(false, true)
        }else{
          await render()
        }
        return
      }
      else if (keyName === 'f12') {
        CTL_FLAGS.DEBUG = !CTL_FLAGS.DEBUG
        await render()
        return
      }
      else if (keyName === 'r'){
        if(keyctrl){
          pagesController.reset()
          await chapterLoader(undefined, true)
        }else if (keyshift){
          await render(false, true)
        }else {
          await render(true, true)
        }
      }
      else if(keyName === 'm'){
        CTL_FLAGS.FIT_MODE = CTL_FLAGS.FIT_MODE === 'contain' ? 'cover' : 'contain'
        await render(false, true)
      }
      else if (keyName === 'c') {
        process.stdout.write(ansi.clearViewport)
        process.stdout.write(ansi.cursorShow)
        TerminalControl.exitRawMode(keyPressHandle)
        let optionsPrompt = {target: SignalsCodes.exit}
        while(true){
          optionsPrompt = await prompts(terminalReaderChapterOptions())
          if(optionsPrompt.target === SignalsCodes.list_add){
            await addToUserListPrompt(MANGA_INFO)
          }else break
        }
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
          await downloadSection(MANGA_INFO, props.chapters, chapterController.geChapterIndex(), chapterController.getLang(), mangaProvider)
          TerminalControl.openRawMode(keyPressHandle)
          await render()
          return
        }
        else if (optionsPrompt.target === SignalsCodes.get_chapters_list) {
          let outputStatus = -1
          await ChapterSelect(mangaProvider, MANGA_INFO, props.chapters, async (e, stop)=>{
            const {chapterLanguage, chapterIndex} = e
            chapterController.setChapterLanguage(chapterLanguage)
            chapterController.setChapterIndex(chapterIndex)
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
    CTL_FLAGS.IS_FIRST_RUN = false
  })
}
