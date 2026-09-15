import ora from "ora";
import prompts, {type Choice } from "@alex_521/prompts";
import { terminalReader } from "./reader.ts";
import type {
  Chapter,
  DownloadProps,
  MangaInfo,
  MangaProvider,
  Translations,
} from "../types/types.ts";
import { DownloadFormat, SignalsCodes} from "../types/enum.ts";
import {
  downloadFormatOptions,
  historyOptionsPropmts,
  historySectionPrompt,
  lastedSectionPrompt,
  mainPrompt,
  popularMangaSelectOptions,
  popularSectionPrompt,
  searchPrompt,
  searchResultPrompt,
  voidPrompt,
} from "./prompts.ts";
import { ChapterSelect, type ChaperSelectOnSelectType } from "./components/chapterList.ts";
import { Configuration } from "../functions/configuration.ts";
import type { LanguageInterface, LanguageErrorMessages, LanguageLoadingStates, LanguageGenericsWords} from "../functions/lang.ts";
import { getTimeSkip } from "../utils.ts";
import { Notify } from "../functions/notify.ts";
import { History } from "../functions/history.js";

const LOADER = ora();
const CONF = await Configuration.getInstance()

let 
isfirstHistoryLoad = true,
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
        //? Check if the history has already been loaded to avoid unwanted overwriting
        if(isfirstHistoryLoad){
          await History.store()
        }
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
}
async function sectionHistory(provider: MangaProvider) {
  const { settings } = CONF
  let memoryChoicePosition = 0;

  if (isfirstHistoryLoad) {
    await History.load()
    isfirstHistoryLoad = false
  }
  try {
    while (true) {
      const historyParse = History.parseMap()
      const historyList = settings.history_filterByProvider ? historyParse.filter(e => e.server === provider.name) : historyParse
      if (historyList.length < 1) {
        await prompts(voidPrompt(i18nErrors.void_Section.msg));
        break;
      }
      const historySelect = await prompts(
        historySectionPrompt( historyList.map(
          (e, i): Choice => ({
            title: e.mangaTitle,
            description: `${e.last_title} ⏺ ${e.server} ⏺ ${getTimeSkip(e.time)}`,
            value: String(i)
          })
        ), memoryChoicePosition)
      );
      if (!historySelect.target) break
      const targetIndex = parseInt(historySelect.target)
      memoryChoicePosition = targetIndex
      const mangaTarget = historyList[targetIndex];

      const optionsSelect = await prompts(
        historyOptionsPropmts(mangaTarget.mangaTitle)
      );

      if (!optionsSelect.target || optionsSelect.target === SignalsCodes.exit) {
        continue;
      }
      //dynamic server change
      if (mangaTarget.server !== provider.name) {
        LOADER.start(`changing server to: ${mangaTarget.server}`)
        provider = await CONF.conf_provider.setProviderByName(mangaTarget.server) ?? provider
        if (LOADER.isSpinning) LOADER.stop()
      }

      LOADER.start(i18nLoadings.loading_chapters);

      const chapterList = await provider.getChapterList(mangaTarget.mangaSrc);
      if (LOADER.isSpinning) LOADER.stop();
      if (!chapterList) continue;

      switch (optionsSelect.target) {
        case SignalsCodes.resume_read: {
          await terminalReader(
            {
              title: mangaTarget.mangaTitle,
              src: mangaTarget.mangaSrc
            },
            chapterList,
            mangaTarget.last_index,
            mangaTarget.last_lang,
          );
          break;
        }
        case SignalsCodes.get_chapters_list:
          await sectionChapterList(provider, { title: mangaTarget.mangaTitle, src: mangaTarget.mangaSrc }, chapterList);
          break;
        case SignalsCodes.download_chapter:
          await downloadSection({ title: mangaTarget.mangaTitle, src: mangaTarget.mangaSrc },
            chapterList,
            mangaTarget.last_index,
            mangaTarget.last_lang,
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
    const chapterTranslate = chapterTarget.translations[lang]
    const downloaderInstace = Downloader.getInstance()
    LOADER.start('Getting pages url\'s...')
    const pagesUrls = await server.getChapterPages(chapterTranslate?.id as string)
    LOADER.stop()
    const downloadProps: DownloadProps = {
      chapterTitle: chapterTranslate?.title ?? chapterTranslate?.title ?? '',
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
