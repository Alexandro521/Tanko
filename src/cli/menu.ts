import ora from "ora";
import prompts, {type Choice } from "@alex_521/prompts";
import { terminalReader } from "./reader.ts";
import { SqliteDB } from "../database/sqlite/sqlite.ts";
import type {
  Chapter,
  DownloadProps,
  HistoryObject2,
  MangaInfo,
  MangaProvider,
  ServerName,
  Translations,
} from "../types/types.ts";
import { DownloadFormat, SignalsCodes} from "../types/enum.ts";
import {
  addToUserListPrompt,
  createUserListPropmt,
  downloadFormatOptions,
  historyOptionsPropmts,
  historySectionPrompt,
  lastedSectionPrompt,
  listRecordSelectOptions,
  mainPrompt,
  popularMangaSelectOptions,
  popularSectionPrompt,
  searchPrompt,
  searchResultPrompt,
  UserlistConfigPrompt,
  UserListEntriesPrompt,
  UserListPropmt,
  voidPrompt,
} from "./prompts.ts";
import { ChapterSelect, type ChaperSelectOnSelectType } from "./components/chapterList.ts";
import { Configuration } from "../functions/configuration.ts";
import type { LanguageInterface, LanguageErrorMessages, LanguageLoadingStates, LanguageGenericsWords} from "../functions/lang.ts";
import { timeSkipFormater, extractChapterSrcByLang } from "../utils.ts";
import { Notify, NotifyType } from "../functions/notify.ts";
import ansi from 'ansi-escapes'
import chalk from "chalk";
import { DOWNLOADS_DEFAULT_DIR } from "../const.ts";
import type { ListRecord, ReadHistoryObject, UserlistsTable } from "../types/database.js";
import { UserLists } from "../functions/userlists.ts";
//import { TimeTracker } from "../trackers/local.ts";

const DB = await SqliteDB.getInstance()
//const TIME_TRACKER = TimeTracker.getInstance()
//TIME_TRACKER.track('session', 'global', {})

const LOADER = ora();
const CONF = await Configuration.getInstance()

let 
i18nErrors: LanguageErrorMessages,
i18nLoadings: LanguageLoadingStates,
i18nGenerics: LanguageGenericsWords,
i18nLanguage: LanguageInterface

const setI18n = (language: LanguageInterface) => {
  i18nLanguage = language
  i18nLoadings = language.loading_states
  i18nErrors   = language.err_messages
  i18nGenerics = language.generics_words
}

const pushError = (e: any) => {
  if (LOADER.isSpinning)
    LOADER.stop()
  Notify.pushError(e)
}

export async function main() {
  setI18n( await CONF.getLanguageInterface() )
  let mangaProvider = CONF.conf_provider.provider
  CONF.on('updateprovider', (e) => mangaProvider = e)
  CONF.on('updatelanguage', setI18n)
  try {
    let mainLoop = true
    while (mainLoop) {
      const main = await prompts(mainPrompt());
      if (!main?.target || main.target === SignalsCodes.exit){
        break
      }
      switch (main.target) {
        case SignalsCodes.search_section:
          await sectionSearch(mangaProvider);
          break;
        case SignalsCodes.history_section:
          await sectionHistory(mangaProvider);
          break;
        case SignalsCodes.popular_section:
          await sectionPopulars(mangaProvider);
          break;
        case SignalsCodes.user_list_section:
          await userListSection()
          break;
        case SignalsCodes.configuration_section: 
        {
          const { configurationTui }= await import("./configuration.ts");
          await configurationTui();
          break;
        }
        case SignalsCodes.lasted_section:
          await sectionLastest(mangaProvider);
          break;
      }
    }
  } catch (e) {
    pushError(e)
  }
}

async function sectionSearch(server: MangaProvider) {
  try {
    while (true) {
      const search = await prompts(searchPrompt());
      if (!search?.query) break;
      LOADER.start(`${i18nLoadings.searching} ${search.query}...`);
      const results = await server.search(search.query);

      if (!results || results.length < 1) {
        if (LOADER.isSpinning) 
          LOADER.fail(i18nErrors.no_results.msg);
        continue;
      } else if (LOADER.isSpinning) 
        LOADER.stop();

      let memoizedLastChoice = 0;

      const choices = results.map((result, i): Choice => ({ 
        title: result.title, 
        value: String(i) 
        }),
      );

      while (true) {
        const targetIndex = await prompts(
          searchResultPrompt(choices, memoizedLastChoice),
        );
        if (!targetIndex?.target) {
          break;
        }
        memoizedLastChoice = Number(targetIndex.target);
        const targetResult = results[Number(targetIndex.target)];
        await sectionChapterList(server, targetResult);
      }
    }
  } catch (e) {
    pushError(e)
  }
}
async function sectionChapterList(provider: MangaProvider, mangaInfo: MangaInfo, memoizedChapters: Chapter[] | undefined = undefined) {
  try{
  await ChapterSelect(provider, mangaInfo, memoizedChapters, async (e) => {
    const { chapterActions, chapterIndex, chapterLanguage, chaptersList } = e
    if (chapterActions === SignalsCodes.read_chapter) {
      await terminalReader(
        mangaInfo,
        chaptersList,
        chapterIndex,
        chapterLanguage,
      )
    } else if (chapterActions === SignalsCodes.download_chapter) {
      await downloadSection(
        mangaInfo,
        chaptersList,
        chapterIndex,
        chapterLanguage,
        provider,
      )
    }
  })
  }catch(e){
    if(e instanceof Error)
      Notify.pushError(e)
  }
}
function castHistoryObject($: ReadHistoryObject): HistoryObject2 {
       return {
      chapter_index: $.chapter_index,
        chapter_src: $.chapter_src,
        lang_iso: $.lang_iso,
        page_index: $.page_index,
        pages_read: $.pages_read,
        read_progress: $.read_progress,
        sort_order: $.sort_order,
        mangainfo: {
          title: $.manga_title,
          src: $.manga_src,
          anilistId: $.manga_anilist_id
        },
        provider: $.manga_provider,
        chapter_title:$.chapter_title
      }
}
async function loadProviderByName(newProvider: ServerName) {
  const currentProvider = CONF.conf_provider.settings.name
  let provInstance = CONF.conf_provider.providerInstance
  if (newProvider !== currentProvider) {
    LOADER.start(`changing provider to: ${newProvider}`)
    provInstance = await CONF.conf_provider.setProviderByName(newProvider) || provInstance
    if (LOADER.isSpinning) LOADER.stop()
  }
  return provInstance
}
async function sectionHistory(provider: MangaProvider) {
  const { settings } = CONF
  const historyGroupByManga = settings.history_groupByManga
  let memoryChoicePosition = 0;
  try {
    while (true) {
      const historyParse = DB.getReadHistory()
      let historyList = settings.history_filterByProvider ? historyParse.filter(e => e.manga_provider === provider.name) : historyParse
      if (historyList.length < 1) {
        await prompts(voidPrompt(i18nErrors.void_Section.msg));
        break;
      }
      if(historyGroupByManga){
        const filterMap: {[key:string]: any} = {}
        const groupHistory = historyList.filter((e)=>{
          if(filterMap[e.manga_src]) return false
          else {
            filterMap[e.manga_src] = 1
            return true
          }
        })
        historyList = groupHistory;
      }
      const historySelect = await prompts(
        historySectionPrompt(historyList.slice(0, Math.min(historyList.length-1,settings.history_maxSize))
        .map(
          (e, i): Choice => ({
            title: historyGroupByManga ? e.manga_title : e.chapter_title,
            description: `${historyGroupByManga ? e.chapter_title : e.manga_title} ⏺ ${e.manga_provider} ⏺ ${timeSkipFormater(e.time_diff)}`,
            value: String(i)
          })
        ), memoryChoicePosition)
      );
      if (!historySelect.target) break
      const targetIndex = parseInt(historySelect.target)
      memoryChoicePosition = targetIndex
      const mangaTarget = historyList[targetIndex];
      let optionsSelect = {target: SignalsCodes.exit}
      
      while(true){
        optionsSelect = await prompts(
          historyOptionsPropmts(mangaTarget.manga_title)
        );
        if(optionsSelect.target === SignalsCodes.list_add){
          await addToUserListPrompt({ 
            src: mangaTarget.manga_src,
            title: mangaTarget.manga_title
          })
        }else {
          break
        }
      }
      if (!optionsSelect.target || optionsSelect.target === SignalsCodes.exit) {
        continue;
      }
      provider = await loadProviderByName(mangaTarget.manga_provider)

      const historyObject = castHistoryObject(mangaTarget)
      LOADER.start(i18nLoadings.loading_chapters);
      const chapterList = await provider.getChapterList(mangaTarget.manga_src);
      if (LOADER.isSpinning) LOADER.stop();
      if (!chapterList) continue;
      switch (optionsSelect.target) {
        case SignalsCodes.resume_read: {
          await terminalReader(
            historyObject,
            chapterList,
            mangaTarget.chapter_index,
            mangaTarget.lang_iso,
          );
          break;
        }
        case SignalsCodes.get_chapters_list:
          await sectionChapterList(provider, { title: mangaTarget.manga_title, src: mangaTarget.manga_src }, chapterList);
          break;
        case SignalsCodes.download_chapter:
          await downloadSection({ title: mangaTarget.manga_title, src: mangaTarget.manga_src },
            chapterList,
            mangaTarget.chapter_index,
            mangaTarget.lang_iso,
            provider,
          )
          break;
        default:
          break;
      }
    }
  } catch (e) {
    pushError(e)
  }
}
async function sectionPopulars(server: MangaProvider) {
  try {
    LOADER.start(i18nLoadings.default_loading);
    const popularList = await server.getPopulars();
    LOADER.stop();

    if (!popularList || popularList.length < 0) {
      await prompts(voidPrompt(i18nErrors.no_results.msg));
      return;
    }

    const choices = popularList.map((popular, index): Choice => {
      return {
        title: popular.title,
        description: popular.description,// popular.chapters?.[0].title ?? undefined,
        value: String(index),
      };
    });
    
    let memoryChoicePosition = 0;
    while (true) {
      const popularSelect = await prompts(
        popularSectionPrompt(choices, memoryChoicePosition),
      )
      if (!popularSelect.target) break;
      const targetIndex = parseInt(popularSelect.target)
      const targetManga = popularList[targetIndex];
      memoryChoicePosition = targetIndex
      const onSelect: ChaperSelectOnSelectType = async (res) =>{
        const {chapterActions, chaptersList, chapterLanguage, chapterIndex} = res
        switch(chapterActions){
          case SignalsCodes.read_chapter: {
              await terminalReader(
                targetManga,
                chaptersList,
                chapterIndex,
                chapterLanguage,
              );
              break
          }
          case SignalsCodes.download_chapter: {
              await downloadSection(
                targetManga,
                chaptersList,
                chapterIndex,
                chapterLanguage,
                server
              )
            break
          }
        }
      }
      await ChapterSelect(server, targetManga, undefined, onSelect, popularMangaSelectOptions(targetManga.title))
    }
  } catch (e) {
    pushError(e)
  }
}
async function sectionLastest(server: MangaProvider) {
  try {
    LOADER.start(i18nLoadings.default_loading);
    const mangaList = await server.getLastMangas();
    LOADER.stop();
    if (!mangaList || mangaList.length < 0) {
      await prompts(voidPrompt(i18nErrors.no_results.msg));
      return;
    }
    const choices = mangaList.map((e, index): Choice => {
      return {
        title: e.title,
        description: e.description,
        value: String(index),
      };
    });
    let memoryChoicePositionLastMangas = 0;
    while (true) {
      const mangaIndex = await prompts(
        lastedSectionPrompt(choices, memoryChoicePositionLastMangas),
      )
      if (!mangaIndex.target) {
        break;
      }
      memoryChoicePositionLastMangas = Number(mangaIndex.target);
      const targetManga = mangaList[Number(mangaIndex.target)];
        await ChapterSelect(server, targetManga, undefined, async (e)=>{
          const {chaptersList, chapterIndex, chapterLanguage, chapterActions } = e
          switch(chapterActions){
            case SignalsCodes.read_chapter:
              await terminalReader(
                targetManga, 
                chaptersList, 
                chapterIndex, 
                chapterLanguage);
              break
            case SignalsCodes.download_chapter:
              await downloadSection(
                targetManga, 
                chaptersList, 
                chapterIndex, 
                chapterLanguage, 
                server)
              break
          }
      })
    }
  } catch (e) {
    pushError(e)
  }
}
export async function downloadSection(mangaInfo: MangaInfo, chapterList: Chapter[], index: number, lang: Translations, server: MangaProvider) {
  try {
    const {Downloader} = await import("../functions/downloader.ts")
    let pagesCount = 0;
    const chapterTarget = chapterList[index]
    const chapterTranslate = extractChapterSrcByLang(chapterTarget, lang)
    const downloaderInstace = Downloader.getInstance()
    LOADER.start('Getting pages url\'s...')
    const pagesUrls = await server.getChapterPages(chapterTranslate.id as string)
    LOADER.stop()
    const downloadProps: DownloadProps = {
      chapterTitle: chapterTranslate.title,
      format: DownloadFormat.pdf,
      mangaTitle: mangaInfo.title,
      serverName: server.name,
      pages: pagesUrls,
    }
    downloaderInstace.on('download_page', (e) => {
      pagesCount++;
      
      LOADER.text = `${i18nLoadings.downloading_pages} #${e + 1} [${pagesCount}/${pagesUrls.length}]`
    })
    downloaderInstace.on('done', () => {
      LOADER.stop()
      const noti = Notify.getInstace()
      noti.push({
        title: i18nLanguage.configuration.downloads.complete,
        type: NotifyType.event,
        message:
          `${mangaInfo.title} chapter, ${ansi.link(chalk.underline.blueBright(chapterTranslate.title), DOWNLOADS_DEFAULT_DIR)} downloaded`
      })
    })
    downloaderInstace.on('state', (state) => {
      if (LOADER.isSpinning)
        LOADER.text = state + '...'
    })
    while (true) {
      pagesCount = 0
      const format = await prompts(downloadFormatOptions())
      if (!format?.target) {
        downloaderInstace.free()
        break
      }
      downloadProps.format = format.target
      LOADER.start('downloading...')
      await downloaderInstace.download(downloadProps)
      LOADER.stop()
    }
  } catch (e) {
    if (LOADER.isSpinning) LOADER.stop()
    
    pushError(e)
  }
}

async function userListSection() {
  let loop = true
  /** displays all user lists */
  while (loop) {
    const options = await prompts(UserListPropmt())
    if (!options.target || (options.target === SignalsCodes.exit)) {
      break
    }
    if (options.target === SignalsCodes.list_create) {
      await createUserListPropmt()
      continue;
    }
    await displayUserList(<UserlistsTable> options.target)
  }
}

async function displayUserList(list: UserlistsTable) {
  let mainLoop = true
  const history = DB.getReadHistory()
  while (mainLoop) {
    const entriesPropmt = await prompts(UserListEntriesPrompt(list))

    if (
      !entriesPropmt.target || 
      entriesPropmt.target === SignalsCodes.exit
    ) break

    /**
     * verifying that the list has not been deleted.
     * If the list has already been deleted,
     * continuing in the loop causes an error that crashes the program.
     */
    if (entriesPropmt.target === SignalsCodes.list_conf) {
      await UserlistConfigPrompt(list)
      if (UserLists.exists(list.id)) {
        list = UserLists.getUserList(list.id)!
      } else {
        break
      }
      continue
    } 
      const target = <ListRecord>entriesPropmt.target
      let childLoop = true
      const historyIndex = history.findIndex((e)=> e.manga_src === target.manga_id)
      while (childLoop) {
        let promptObject = listRecordSelectOptions(`${list.name} > ${target.title}`)
        /**
         * If the selected manga is not in the reading history,
         *  we remove the first element from the options array 
         * so that the option with the code 'resume_read' is not visible.
         */
        if(historyIndex < 0){
          (<Choice[]>promptObject.choices).shift()
        }
        const options = await prompts(promptObject)
        if (!options.target || options.target === SignalsCodes.exit) {
          break
        }
        switch (options.target) {
          case SignalsCodes.resume_read: {
            try{
              const historyObject = history[historyIndex]
              const provider = await loadProviderByName(historyObject.manga_provider)
              if(!LOADER.isSpinning) LOADER.start(i18nLoadings.loading_chapters)
              const chapters = await provider.getChapterList(historyObject.manga_src)
              if(LOADER.isSpinning) LOADER.stop()
              await terminalReader(castHistoryObject(historyObject), chapters, historyObject.chapter_index, historyObject.lang_iso)
              break
            }catch(e){
              if(LOADER.isSpinning) LOADER.stop()
              if(e instanceof Error){
                Notify.pushError(e)
              }
            }
            break
          }
          case SignalsCodes.list_add: {
            await addToUserListPrompt({src: target.manga_id, title: target.title})
            break
          }
          case SignalsCodes.list_remove: {
            UserLists.removeFromList(list.id, target.manga_id)
            Notify.pushMessage(`${target.title} has been removed from the ${list.name} list`)
            childLoop = false
            break
          }
          case SignalsCodes.get_chapters_list: {
            if(historyIndex > -1){
              await loadProviderByName(history[historyIndex].manga_provider)
            }
            await sectionChapterList(CONF.conf_provider.providerInstance, {src: target.manga_id, title: target.title})
            break
          }
        }
      }
  }
}