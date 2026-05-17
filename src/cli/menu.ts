import ansi from "ansi-escapes";
import ora from "ora";
import prompts, { type Choice } from "@alex_521/prompts";
import { downloadChapter } from "../functions/downloader.js";
import { History } from "../functions/history.js";
import { terminalReader } from "./reader.js";
import type { Chapter, MangaServerInterface } from "../types/types.js";
import { SignalsCodes } from "../types/enum.js";
import {
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
import { Configuration } from "../functions/configuration.js";
import type { ErrorMessages, LoadingStates } from "src/types/lang.js";
import fs from "fs";

const loading = ora();

export const clearScreen = () => {
  console.log(ansi.clearViewport);
  console.log(WELCOME_MESSAGE);
};

let err_messages: ErrorMessages, loading_states: LoadingStates;

export async function main() {
  const instace = await Configuration.getInstance();
  let server = instace.getClient();
  let config = instace.configuration;
  const lang = instace.getLang();
  err_messages = lang.err_messages;
  loading_states = lang.loading_states;

  instace.on("load", () => {
    server = instace.getClient();
    config = instace.configuration;
    const lang = instace.getLang();
    err_messages = lang.err_messages;
    loading_states = lang.loading_states;
  });
  console.log(WELCOME_MESSAGE);
  try {
    if (!server && config.client.need_browser)
      throw new Error(err_messages.client_switch.msg);
    while (true) {
      const main = await prompts(mainPrompt());
      if (!main?.target) {
        await instace.closeBrowser();
        break;
      }
      switch (main.target) {
        case SignalsCodes.search_section:
          await search(server);
          break;
        case SignalsCodes.history_section:
          await history(server);
          break;
        case SignalsCodes.popular_section:
          await populars(server);
          break;
        case SignalsCodes.configuration_section:
          await configurationUI();
          break;
        case SignalsCodes.lasted_section:
          await lastedSection(server);
          break;
        case SignalsCodes.exit:
          await instace.closeBrowser();
          process.exit(0);
      }
      clearScreen();
    }
  } catch (e) {
    console.log(e);
  }
}

async function search(server: MangaServerInterface) {
  clearScreen();
  try {
    while (true) {
      const searchQuery = await prompts(searchPrompt());
      if (!searchQuery?.query) {
        break;
      }
      loading.start(`${loading_states.searching} ${searchQuery.query}...`);
      const results = await server.search(searchQuery.query);

      if ((results?.length && results.length < 1) || !results) {
        clearScreen();
        loading.fail(err_messages.no_results.msg);
        continue;
      }
      const choices = results.map((res): Choice => {
        return {
          title: res.label,
          value: res,
        };
      });
      if (loading.isSpinning) loading.stop();
      clearScreen();
      const selectResult = await prompts(searchResultPrompt(choices));

      if (!selectResult?.target) {
        clearScreen();
        continue;
      }
      await loadMangaChapter(server, selectResult.target.link);
      clearScreen();
    }
  } catch (e) {
    console.log(e);
  }
}
async function getChapterLang(chapter: Chapter) {
  const avalibleLanguages = Object.values(chapter.src); //as ChapterLangStruct[]
  let lang = avalibleLanguages[0].lang;
  if (chapter.lang_n > 1) {
    const targetLang = await prompts(chapterLangChoices(avalibleLanguages));
    if (!targetLang?.target) {
      clearScreen();
      return null;
    }
    lang = targetLang.target.lang;
  }
  return lang;
}

async function loadMangaChapter(
  server: MangaServerInterface,
  mangaSrc: string,
) {
  clearScreen();
  try {
    loading.start(`${loading_states.loading_chapters}...`);
    const chapterList = await server.getMangaInfo(mangaSrc);
    if (!chapterList || chapterList.chapters.length < 0) {
      loading.fail(err_messages.chapter_loading.msg);
      return;
    }
    loading.stop();

    const choices: Choice[] = chapterList.chapters.map((e, i) => {
      return {
        title: Object.values(e.src)[0].title,
        value: i + 1,
      };
    });

    while (true) {
      const chapterIndex = await prompts(
        generateChapterList(chapterList.title, choices),
      );
      if (!chapterIndex.chapter) {
        clearScreen();
        break;
      }
      const targetChapter = chapterList.chapters[chapterIndex.chapter - 1];
      let lang;
      if ((lang = await getChapterLang(targetChapter)) === null) {
        continue;
      }
      clearScreen();
      const options = await prompts(basicChapterOptions());

      if (!options.target) {
        clearScreen();
        continue;
      }
      if (options.target === SignalsCodes.read_chapter) {
        await terminalReader(chapterList, chapterIndex.chapter, lang, server);
      } else if (options.target === SignalsCodes.download_chapter) {
        //  await downloadChapter(chapterInfo.mangaTitle, chapterInfo.title, chapterInfo.pages)
      }

      clearScreen();
    }
  } catch (e) {
    if (loading.isSpinning) loading.fail();
    console.log(e);
  }
}

async function history(server: MangaServerInterface) {
  clearScreen();
  const history = History.fetch();

  if (history.length < 1) {
    await prompts(voidPrompt(err_messages.void_Section.msg));
    return;
  }

  const choices = history.map((e, index): Choice => {
    return {
      title: e.mangaTitle,
      description: e.last_title,
      value: index,
    };
  });

  while (true) {
    const mangaIndex = await prompts(historySectionPrompt(choices));

    if (!mangaIndex?.target) {
      clearScreen();
      break;
    }
    const manga = history[mangaIndex.target];
    // clearScreen()
    const options = await prompts(historyChapterOptions(manga.mangaTitle));

    if (!options.target) {
      clearScreen();
      continue;
    }
    if (options.target === SignalsCodes.resume_read) {
      loading.start(loading_states.loading_chapters);
      const chapterList = await server.getMangaInfo(manga.mangaSrc);
      if (loading.isSpinning) loading.stop();
      if (!chapterList) continue;
      await terminalReader(
        chapterList,
        manga.last_index,
        manga.last_lang,
        server,
      );
    } else if (options.target === SignalsCodes.get_chapters_list)
      await loadMangaChapter(server, manga.mangaSrc);
    else if (options.target === SignalsCodes.download_chapter)
      // await downloadChapter(manga.mangaTitle, manga.mangaSrc, manga.pages)
      clearScreen();
  }
}

async function populars(server: MangaServerInterface) {
  clearScreen();
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
        description: popular.last_chapter.title,
        value: index + 1,
      };
    });

    while (true) {
      const select = await prompts(popularSectionPrompt(choices));

      if (!select.target) {
        clearScreen();
        break;
      }
      clearScreen();
      const info = populars[select.target - 1];
      fs.appendFileSync(
        "populars.log",
        JSON.stringify({ index: select.target }, null, "\t"),
      );
      const option = await prompts(popularMangaSelectOptions(info.title));
      if (!option?.target) {
        clearScreen();
        continue;
      }
      loading.start(loading_states.default_loading);
      const mangainfo = await server.getMangaInfo(info.src);
      if (!mangainfo) throw new Error("");
      const lastChapter = mangainfo.chapters[mangainfo.chapters.length - 1];
      let lang;
      if ((lang = await getChapterLang(lastChapter)) === null) {
        continue;
      }
      if (loading.isSpinning) loading.stop();

      if (option.target === SignalsCodes.read_chapter) {
        await terminalReader(
          mangainfo,
          mangainfo.chapters.length - 1,
          lang,
          server,
        );
      } else if (option.target === SignalsCodes.download_chapter) {
        // if (res)
        // await downloadChapter(res.mangaTitle, res.title, res.pages)
      } else if (option.target === SignalsCodes.get_chapters_list) {
        await loadMangaChapter(server, info.src);
      } else if (option.target === SignalsCodes.exit) {
        clearScreen();
        continue;
      }
      clearScreen();
    }
  } catch (e) {
    if (loading.isSpinning) loading.fail(err_messages.fetching.msg);
    console.log(e);
  }
}

async function lastedSection(server: MangaServerInterface) {
  clearScreen();
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
        description: e.last_chapters[0].title,
        value: index,
      };
    });

    while (true) {
      const mangaIndex = await prompts(lastedSectionPrompt(choices));
      if (!mangaIndex.target) {
        clearScreen();
        break;
      }
      const targetManga = mangaList[mangaIndex.target];
      const lastChapterList = targetManga.last_chapters.map(
        (chapter, index): Choice => {
          return { title: chapter.title, value: index };
        },
      );

      while (true) {
        let chapterIndex = await prompts(
          generateChapterList(targetManga.title, lastChapterList),
        );

        if (!chapterIndex.chapter) {
          clearScreen();
          break;
        }
        const chapterTarget = lastChapterList[chapterIndex.chapter];
        const chapterOptions = await prompts(basicChapterOptions());

        if (!chapterOptions.target) {
          clearScreen();
          continue;
        }

        loading.start(
          `${loading_states.default_loading} ${chapterTarget.title} : ${chapterTarget.title}`,
        );
        const allChapterList = await server.getMangaInfo(targetManga.src);
        let lang;
        loading.stop();
        if (!allChapterList) continue;
        const index = allChapterList.chapters.length - chapterIndex.chapter - 1;
        const chapter = allChapterList.chapters[index];
        if ((lang = await getChapterLang(chapter)) === null) {
          continue;
        }
        if (chapterOptions.target === SignalsCodes.read_chapter)
          await terminalReader(allChapterList, index, lang, server);
        else if (chapterOptions.target === SignalsCodes.download_chapter)
          //    await downloadChapter(res.mangaTitle, res.title, res.pages)
          continue;
        else if (chapterOptions.target === SignalsCodes.exit) {
          clearScreen();
          continue;
        }
        clearScreen();
      }
    }
  } catch (e) {
    console.log(e);
  }
}
