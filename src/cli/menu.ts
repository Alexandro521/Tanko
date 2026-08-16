import ora from "ora";
import prompts, {type Choice } from "@alex_521/prompts";
import { Downloader } from "../functions/downloader.js";
import { History } from "../functions/history.js";
import { terminalReader } from "./reader.js";
import type {
  Chapter,
  DownloadProps,
  MangaInfo,
  MangaProvider,
  Translations,
} from "../types/types.js";
import { DownloadFormat, SignalsCodes} from "../types/enum.js";
import {
  askChapterLang,
  basicChapterOptions,
  downloadFormatOptions,
  chapterListPrompt,
  historyChapterOptions,
  historySectionPrompt,
  lastedSectionPrompt,
  mainPrompt,
  popularMangaSelectOptions,
  popularSectionPrompt,
  searchPrompt,
  searchResultPrompt,
  voidPrompt,
} from "./prompts.js";
import { configurationTui } from "./configuration.js";
import { Configuration } from "../functions/configuration.js";
import type { LangIso, LanguageInterface } from "../functions/lang.ts";
import { extractTitleByLang, getTimeSkip } from "../utils.js";
import { Notify, NotifyType } from "../functions/notify.js";
import { LocalTracker, type LocalTrackerProps } from "../trackers/local.js";
import chalk from "chalk";


const loading = ora();
const localTracker = LocalTracker.getInstance()
let err_messages: LanguageInterface['err_messages'],
loading_states: LanguageInterface['loading_states'],
lang: LanguageInterface

const notifyInstance = Notify.getInstace()

function pushError(e: any) {
  if (loading.isSpinning)
    loading.stop()
  if (e instanceof Error) {
    notifyInstance.push({
      title: e.name,
      message: e.message,
      type: NotifyType.error,
    })
  }
}

export async function main(confInstance: Configuration) {
  let SERVER = confInstance.conf_provider.provider
  lang = await confInstance.getLanguageInterface()
  loading_states = lang.loading_states
  err_messages = lang.err_messages
  confInstance.on('updateprovider', (e)=> SERVER = e)
  confInstance.on('updatelanguage', (e)=> {
    lang = e
    err_messages = lang.err_messages;
    loading_states = lang.loading_states;
  })
  try {
    while (true) {
      const main = await prompts(mainPrompt());
      if (!main?.target) break;
      switch (main.target) {
        case SignalsCodes.search_section:
          await search(SERVER);
          break;
        case SignalsCodes.history_section:
          await history(SERVER);
          break;
        case SignalsCodes.popular_section:
          await populars(SERVER);
          break;
        case SignalsCodes.configuration_section:
          await configurationTui();
          break;
        case SignalsCodes.lasted_section:
          await lastedSection(SERVER);
          break;
        case SignalsCodes.exit:
          await confInstance.store()
          await confInstance.conf_browser.close();
          process.exit(0);
      }
    }
  } catch (e) {
    pushError(e)
  }
}

async function search(server: MangaProvider) {
  try {
    
    while (true) {
      const searchQuery = await prompts(searchPrompt());
      if (!searchQuery?.query) break;
      loading.start(`${loading_states.searching} ${searchQuery.query}...`);
      const results = await server.search(searchQuery.query);
      //
      if (!results || results.length < 1) {
        if (loading.isSpinning) loading.fail(err_messages.no_results.msg);
        continue;
      } else if (loading.isSpinning) loading.stop();
    
      let memoryChoicePosition = 0;
      const choices = results.map(
        (res, i): Choice => ({ title: res.title, value: String(i) }),
      );
      while (true) {
        const targetIndex = await prompts(
          searchResultPrompt(choices, memoryChoicePosition),
        );
        if (!targetIndex?.target) {
          
          break;
        }
        memoryChoicePosition = Number(targetIndex.target);
        const targetResult = results[Number(targetIndex.target)];

        await loadMangaChapter(server, targetResult);
        
      }
    }
  } catch (e) {
    pushError(e)
  }
}

async function loadMangaChapter(
  server: MangaProvider,
  mangaInfo: MangaInfo,
  chaptersMemory: Chapter[] | null = null,
) {
  try {

    loading.start(`${loading_states.loading_chapters}...`);
    const chapterList = chaptersMemory ?? await server.getChapterList(mangaInfo.src)

    if(!chapterList ||chapterList.length < 0) {
      loading.fail(err_messages.chapter_loading.msg);
      return;
    } else if(loading.isSpinning) loading.stop();

    const chaptersCount = Math.max(chapterList[0].number, chapterList[chapterList.length -1].number, chapterList.length)
    const localTrackerProps: LocalTrackerProps = {
      chapterCount: chaptersCount,
      chapterIndex: 0,
      mangaId: mangaInfo.src
    }

    if(!(await localTracker.exists(localTrackerProps))){
      await localTracker.regist(localTrackerProps)
    }
    let trackData = await localTracker.getStats(localTrackerProps)

    if (trackData.chapterCount < chapterList.length) {
      await localTracker.update(localTrackerProps)
    }

    let indexOfLastChoice = 0;
    while (true) {
      trackData = await localTracker.getStats(localTrackerProps)

      const choices: Choice[] = chapterList.map((e, i) => {
        let title = extractTitleByLang(e, lang.meta.lang as Translations)
        if(trackData.readingMap.has(e.number)){
          title +=' ⏺ '+ chalk.dim(chalk.green('Read'))
        }
        return {
          title,
          value: String(i),
        };
      });
      const readProgress = ((trackData.reading*100)/trackData.chapterCount).toFixed(1)
      const chapterIndex = await prompts(
        chapterListPrompt(mangaInfo.title, indexOfLastChoice, choices, `⏺ Progress: ${readProgress}%`)
      );
      if (!chapterIndex.target) {
        break;
      }
      indexOfLastChoice = Number(chapterIndex.target);
      const targetChapter = chapterList[Number(chapterIndex.target)];
      let targetLang: LangIso;
      if ((targetLang = await askChapterLang(targetChapter)) === null) {
        continue;
      }
      const options = await prompts(basicChapterOptions());

      if (!options.target) {
        continue;
      }
      if (options.target === SignalsCodes.read_chapter) {
        await terminalReader(
          mangaInfo,
          chapterList,
          Number(chapterIndex.target),
          targetLang,
        );
      } else if (options.target === SignalsCodes.download_chapter) {
        loading.start(loading_states.downloading_chapter)
        const target = targetChapter.translations[targetLang]
        const pages = await server.getChapterPages(target?.id as string)
        loading.stop()
        if(pages)
          await downloadSection(
          mangaInfo,
          chapterList,
          Number(chapterIndex.target),
          targetLang,
          server,
        )
      }
    }
  } catch (e) {
    pushError(e)
  }
}

async function history(provider: MangaProvider) {
  try {
    const conf = await Configuration.getInstance()
    const history = 
    conf.settings.history_filterByProvider ?  History.parseMap().filter(e=> e.server === provider.name):History.parseMap()
    
    if (history.length < 1) {
      await prompts(voidPrompt(err_messages.void_Section.msg));
      return;
    }

    const choices = history.map(
      (e, i): Choice => ({
        title: e.mangaTitle,
        description: `${e.last_title} ⏺ ${e.server} ⏺ ${getTimeSkip(e.time)}`,
        value: String(i)
      }),
    );
    let memoryChoicePosition = 0;
    while (true) {
      const mangaIndex = await prompts(
        historySectionPrompt(choices, memoryChoicePosition),
      );
      if (!mangaIndex?.target) {
        break;
      }
      memoryChoicePosition = Number(mangaIndex.target);
      const mangaTarget = history[Number(mangaIndex.target)];
      // clearScreen()
      const options = await prompts(
        historyChapterOptions(mangaTarget.mangaTitle),
      );
      if (!options.target) {

        continue;
      }
      //dynamic server change
      if(mangaTarget.server !== provider.name) {
        loading.start(`changing server to: ${mangaTarget.server}`)
        const confInstance = await Configuration.getInstance()
        if(loading.isSpinning) loading.stop()
        provider = await confInstance.conf_provider.setProviderByName(mangaTarget.server) ?? provider
      }
      loading.start(loading_states.loading_chapters);
      const chapterList = await provider.getChapterList(mangaTarget.mangaSrc);
      if (loading.isSpinning) loading.stop();
      if(!chapterList) continue;
      switch (options.target) {
        case SignalsCodes.resume_read:
          await terminalReader(
            {title: mangaTarget.mangaTitle, src: mangaTarget.mangaSrc},
            chapterList,
            mangaTarget.last_index,
            mangaTarget.last_lang,
  
          );
          break;
        case SignalsCodes.get_chapters_list:
          await loadMangaChapter(provider, {title: mangaTarget.mangaTitle, src: mangaTarget.mangaSrc});
          break;
        case SignalsCodes.download_chapter:
          await downloadSection(   {title: mangaTarget.mangaTitle, src: mangaTarget.mangaSrc},
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

async function populars(server: MangaProvider) {
  try {
    loading.start(loading_states.default_loading);
    const populars = await server.getPopulars();
    loading.stop();

    if (!populars || populars.length < 0) {
      await prompts(voidPrompt(err_messages.no_results.msg));
      return;
    }

    const choices = populars.map((popular, index): Choice => {
      return {
        title: popular.title,
        description: popular.description,// popular.chapters?.[0].title ?? undefined,
        value: String(index),
      };
    });
    let memoryChoicePosition = 0;
    while (true) {
      const select = await prompts(
        popularSectionPrompt(choices, memoryChoicePosition),
      );

      if (!select.target) {
        break;
      }
      memoryChoicePosition = Number(select.target);
      const info = populars[Number(select.target)];
      const option = await prompts(popularMangaSelectOptions(info.title));
      if (!option?.target || option.target === SignalsCodes.exit) {
        continue;
      }
      loading.start(loading_states.default_loading);
      const chapterList = await server.getChapterList(info.src);
      info.title = info.title
      info.description = info.description
      if (loading.isSpinning) loading.stop();
      if (!chapterList) throw new Error("");
      const lastChapter = chapterList[chapterList.length - 1];
      let lang;
      if ((lang = await askChapterLang(lastChapter)) === null) {
        continue;
      }
      if (option.target === SignalsCodes.read_chapter) {
        await terminalReader(
          info,
          chapterList,
          chapterList.length - 1,
          lang,
        );
      } else if (option.target === SignalsCodes.download_chapter) {
        await downloadSection(
          info,
          chapterList,
          chapterList.length - 1,
          lang,
          server
        )
      } else if (option.target === SignalsCodes.get_chapters_list) {
        await loadMangaChapter(server, info, chapterList);
      }
    }
  } catch (e) {
    pushError(e)
  }
}

async function lastedSection(server: MangaProvider) {

  try {
    loading.start(loading_states.default_loading);
    const mangaList = await server.getLastMangas();
    loading.stop();
    if (!mangaList || mangaList.length < 0) {
      await prompts(voidPrompt(err_messages.no_results.msg));
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
      );
      if (!mangaIndex.target) {

        break;
      }
      memoryChoicePositionLastMangas = Number(mangaIndex.target);
      const targetManga = mangaList[Number(mangaIndex.target)];
      const chapterList = await server.getChapterList(targetManga.src)
      const chaptersCount = Math.max(chapterList[0].number, chapterList[chapterList.length -1].number, chapterList.length)
      const localTrackerProps: LocalTrackerProps = {
        chapterCount: chaptersCount,
        chapterIndex: 0,
        mangaId: targetManga.src
      }
      if (!(await localTracker.exists(localTrackerProps))) {
        await localTracker.regist(localTrackerProps)
      }
      const trackerData = await localTracker.getStats(localTrackerProps)
      if (trackerData.chapterCount < chapterList.length) {
        await localTracker.update(localTrackerProps)
      }
      let memoryChoicePosition = 0;
      while (true) {
        const markRead = await localTracker.getStats(localTrackerProps)

        const lastChapterList = chapterList.map(
          (chapter, index): Choice => {
            let title = extractTitleByLang(chapter, (lang.meta.lang as Translations))
            if (markRead.readingMap.has(chapter.number)) {
              title += ' ⏺ '+ chalk.dim(chalk.green('Read'))
            }
            return { 
              title,
              value: String(index) };
          },
        );
        const readProgress = ((trackerData.reading*100)/trackerData.chapterCount).toFixed(1)

        let chapterIndex = await prompts(
          chapterListPrompt(
            targetManga.title,
            memoryChoicePosition,
            lastChapterList,
            `⏺ Progress: ${readProgress}%`
          ),
        );
        if (!chapterIndex.target) {

          break;
        }
        memoryChoicePosition = Number(chapterIndex.target);
        const chapterTarget = lastChapterList[Number(chapterIndex.target)];
        const chapterOptions = await prompts(basicChapterOptions());

        if (!chapterOptions.target) {

          continue;
        }

        loading.start(
          `${loading_states.default_loading} ${chapterTarget.title} : ${chapterTarget.title}`,
        );
        const mangaInfo = await server.getMangaInfo(targetManga.src);
        let chapterLang: Translations | null;
        loading.stop();
        if (!mangaInfo) continue;
        const index = Number(chapterIndex.target);
        const chapter = chapterList[index];
        if ((chapterLang = await askChapterLang(chapter)) === null) {
          continue;
        }
        if (chapterOptions.target === SignalsCodes.read_chapter)
          await terminalReader(mangaInfo,chapterList, index, chapterLang);
        else if (chapterOptions.target === SignalsCodes.download_chapter){
          await downloadSection(mangaInfo,chapterList, index, chapterLang, server)
          continue;
        }
        else if (chapterOptions.target === SignalsCodes.exit) {
          continue;
        }
      }
    }
  } catch (e) {
    pushError(e)
  }
}

export async function downloadSection(mangaInfo: MangaInfo, chapterList: Chapter[], index: number, lang: Translations, server: MangaProvider) {
  try {
    let pagesCount = 0;
    const chapterTarget = chapterList[index]
    const chapterTranslate = chapterTarget.translations[lang]
    const downloaderInstace = Downloader.getInstance()
    loading.start('Getting pages url\'s...')
    const pagesUrls = await server.getChapterPages(chapterTranslate?.id as string)
    loading.stop()
    const downloadProps: DownloadProps = {
      chapterTitle: chapterTranslate?.title ?? chapterTranslate?.title ?? '',
      format: DownloadFormat.pdf,
      mangaTitle: mangaInfo.title,
      serverName: server.name,
      pages: pagesUrls,
    }
    downloaderInstace.on('download_page', (e) => {
      pagesCount++;
      
      loading.text = `${loading_states.downloading_pages} #${e + 1} [${pagesCount}/${pagesUrls.length}]`
    })
    downloaderInstace.on('done', () => {
      loading.stop()
    })
    downloaderInstace.on('state', (state) => {
      if (loading.isSpinning)
        loading.text = state + '...'
    })
    while (true) {
      pagesCount = 0
      const format = await prompts(downloadFormatOptions())
      if (!format?.target) {
        downloaderInstace.free()
        break
      }
      downloadProps.format = format.target
      loading.start('downloading...')
      await downloaderInstace.download(downloadProps)
      loading.stop()
    }
  } catch (e) {
    if (loading.isSpinning) loading.stop()
    
    pushError(e)
  }
}
