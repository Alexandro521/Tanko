import ansi from "ansi-escapes";
import ora from "ora";
import prompts, {type Choice } from "@alex_521/prompts";
import { downloadChapter } from "../functions/downloader.js";
import { History } from "../functions/history.js";
import { terminalReader } from "./reader.js";
import type {
  Chapter,
  ConfigurationInterface,
  MangaInfo,
  MangaProvider,
} from "../types/types.js";
import { SignalsCodes } from "../types/enum.js";
import {
  askChapterLang,
  basicChapterOptions,
  chapterLangChoices,
  generateChapterList,
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
import { WELCOME_MESSAGE } from "../const.js";
import { configurationUI } from "./configuration.js";
import { Configuration, ConfigurationEvents } from "../functions/configuration.js";
import type { ErrorMessages, LangInterface, LoadingStates } from "../types/lang.js";
import { getTimeSkip } from "../utils.js";
import type { Key } from "node:readline";
import { Notify, NotifyType } from "../functions/notify.js";

const loading = ora();

let err_messages: ErrorMessages,
loading_states: LoadingStates,
lang: LangInterface


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
  let SERVER = confInstance.getServer()
  lang = await confInstance.getLanguageInterface()
  loading_states = lang.loading_states
  err_messages = lang.err_messages
  confInstance.on(ConfigurationEvents.updateServer, (e)=> SERVER = e)
  confInstance.on(ConfigurationEvents.updateLanguage, (e)=> {
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
          await configurationUI();
          break;
        case SignalsCodes.lasted_section:
          await lastedSection(SERVER);
          break;
        case SignalsCodes.exit:
          await confInstance.closeBrowser();
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
        (res, i): Choice => ({ title: res.label, value: String(i) }),
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
        await loadMangaChapter(server, targetResult.link);
        
      }
    }
  } catch (e) {
    pushError(e)
  }
}

async function loadMangaChapter(
  server: MangaProvider,
  mangaSrc: string,
  info: MangaInfo | null = null,
) {
  try {

    loading.start(`${loading_states.loading_chapters}...`);
    const mangaInfo = info == null ? await server.getMangaInfo(mangaSrc) : info;
    if (!mangaInfo || mangaInfo.chapters.length < 0) {
      loading.fail(err_messages.chapter_loading.msg);
      return;
    } else if (loading.isSpinning) loading.stop();
    const choices: Choice[] = mangaInfo.chapters.map((e, i) => {
      return {
        title: Object.values(e.translations)[0].title,
        value: String(i),
      };
    });
    let memoryChoicePosition = 0;
    while (true) {
      const chapterIndex = await prompts(
        generateChapterList(mangaInfo.title, memoryChoicePosition, choices),
      );
      if (!chapterIndex.chapter) {
        break;
      }
      memoryChoicePosition = Number(chapterIndex.chapter);
      const targetChapter = mangaInfo.chapters[Number(chapterIndex.chapter)];
      let lang;
      if ((lang = await askChapterLang(targetChapter)) === null) {
        continue;
      }

      const options = await prompts(basicChapterOptions());

      if (!options.target) {
        continue;
      }
      if (options.target === SignalsCodes.read_chapter) {
        await terminalReader(
          mangaInfo,
          Number(chapterIndex.chapter),
          lang,
          server,
        );
      } else if (options.target === SignalsCodes.download_chapter) {
        loading.start(loading_states.downloading_chapter)
        const target = targetChapter.translations[lang]
        const pages = await server.getChapterPages(target?.src as string)
        loading.stop()
        if(pages)
          await downloadChapter(mangaInfo.title ?? 'any', target?.title as string, pages)
      }
    }
  } catch (e) {
    pushError(e)
  }
}

async function history(server: MangaProvider) {
  try {

    const history = History.parseMap();
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
      if(mangaTarget.server !== server.name) {
        loading.start(`changing server to: ${mangaTarget.server}`)
        const confInstance = await Configuration.getInstance()
        if(loading.isSpinning) loading.stop()
        server = await confInstance.setServerByName(mangaTarget.server) ?? server
      }
      switch (options.target) {
        case SignalsCodes.resume_read:
          loading.start(loading_states.loading_chapters);
          const chapterList = await server.getMangaInfo(mangaTarget.mangaSrc);
          if (loading.isSpinning) loading.stop();
          if (!chapterList) continue;
          await terminalReader(
            chapterList,
            mangaTarget.last_index,
            mangaTarget.last_lang,
            server,
          );
          break;
        case SignalsCodes.get_chapters_list:
          await loadMangaChapter(server, mangaTarget.mangaSrc);
          break;
        case SignalsCodes.download_chapter:
          loading.start(loading_states.downloading_chapter)
          const pages= await server.getChapterPages(mangaTarget?.chapterSrc)
          loading.stop()
          await downloadChapter(mangaTarget.mangaTitle, mangaTarget.last_title, pages)
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
        description: popular.chapters[0].title,
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
      const mangainfo = await server.getMangaInfo(info.src);
      if (loading.isSpinning) loading.stop();
      if (!mangainfo) throw new Error("");
      const lastChapter = mangainfo.chapters[mangainfo.chapters.length - 1];
      let lang;
      if ((lang = await askChapterLang(lastChapter)) === null) {
        continue;
      }
      if (option.target === SignalsCodes.read_chapter) {
        await terminalReader(
          mangainfo,
          mangainfo.chapters.length - 1,
          lang,
          server,
        );
      } else if (option.target === SignalsCodes.download_chapter) {
        loading.start(loading_states.downloading_chapter)
        const chapterTarget = lastChapter.translations[lang]
        const pages = await server.getChapterPages(chapterTarget?.src as string)
        loading.stop()
        await downloadChapter(mangainfo.title, chapterTarget?.title as string, pages)
      } else if (option.target === SignalsCodes.get_chapters_list) {
        await loadMangaChapter(server, info.src, mangainfo);
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
        description: e.chapters[0].title,
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
      const lastChapterList = targetManga.chapters.map(
        (chapter, index): Choice => {
          return { title: chapter.title, value: String(index) };
        },
      );
      let memoryChoicePosition = 0;
      while (true) {
        let chapterIndex = await prompts(
          generateChapterList(
            targetManga.title,
            memoryChoicePosition,
            lastChapterList,
          ),
        );
        if (!chapterIndex.chapter) {

          break;
        }
        memoryChoicePosition = Number(chapterIndex.chapter);
        const chapterTarget = lastChapterList[Number(chapterIndex.chapter)];
        const chapterOptions = await prompts(basicChapterOptions());

        if (!chapterOptions.target) {

          continue;
        }

        loading.start(
          `${loading_states.default_loading} ${chapterTarget.title} : ${chapterTarget.title}`,
        );
        const mangaInfo = await server.getMangaInfo(targetManga.src);
        let lang;
        loading.stop();
        if (!mangaInfo) continue;
        const index = Number(chapterIndex.chapter);
        const chapter = mangaInfo.chapters[index];
        if ((lang = await askChapterLang(chapter)) === null) {
          continue;
        }
        if (chapterOptions.target === SignalsCodes.read_chapter)
          await terminalReader(mangaInfo, index, lang, server);
        else if (chapterOptions.target === SignalsCodes.download_chapter){
          loading.start(loading_states.downloading_chapter)
          const chapterTargetLang =  chapter.translations[lang]
          const pages = await server.getChapterPages(chapterTargetLang?.src as string)
          loading.stop()
          await downloadChapter(mangaInfo.title, chapterTargetLang?.title as string, pages)
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
