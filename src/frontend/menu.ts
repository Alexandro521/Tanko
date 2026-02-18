import type { Browser, BrowserContext, Page } from "playwright";
import esc from 'ansi-escapes';
import boxen from "boxen";
import ora from "ora";
import prompts, { type Choice } from "@alex_521/prompts";
import { downloadChapter } from "../functions/downloader.js";
import { History } from "../functions/history.js";
import { terminalReader } from "./reader.js";
import type {
    ChapterInfo,
    ChapterMinInfo,
    LastedManga,
    MangaServerInterface,
    PopularManga,
    SearchResult,
} from "../types.js";
import { SignalsCodes } from '../types.js'
import {
    chapterSelect,
    historyCahpterSelectedOptions,
    historyPrompt,
    mainPrompt,
    PopularMangaSelectOptions,
    search,
    searchChapterSelectedOptions,
    searchResultPrompt,
    voidPrompt
} from './prompts.js';
import { PRIMARY_COLOR, WELCOME_MESSAGE } from "../const.js";
import chalk from "chalk";

const loading = ora();

const clearScreen = () => {
    console.log(esc.clearViewport);
    console.log(WELCOME_MESSAGE);
}

export async function init(server: MangaServerInterface, browser: BrowserContext, page: Page) {
    console.log(WELCOME_MESSAGE)
    try {
        const closeBrowser = async () => {
            loading.start('Saliendo...')
            // await context.storageState({path: 'src/data/browser_storage.json'})
            await page.close()
            await browser.close()
            loading.stop()
        }

        while (true) {
            console.log()
            const main = await prompts(mainPrompt)
            if (!main?.opt) {
                await closeBrowser();
                break
            }

            if (main.opt === SignalsCodes.search_section)
                await searchBar(server)
            else if (main.opt === SignalsCodes.history_section)
                await history(server)
            else if (main.opt === SignalsCodes.popular_section)
                await populars(server)
            else if (main.opt === SignalsCodes.lasted_section)
                await lastedSection(server)
            else if (main.opt === SignalsCodes.exit) {
                closeBrowser()
                break
            }
            clearScreen()
        }
    } catch (e) {
        console.log(e)
    }
}

async function searchBar(server: MangaServerInterface) {
    clearScreen()
    try {
        while (true) {
            const searchQuery = await prompts(search)
            if (!searchQuery?.query) {
                break
            }

            loading.start(`Buscando ${searchQuery.query}...`)
            const results = await server.search(searchQuery.query)

            if (results.length < 1) {
                clearScreen()
                loading.fail('Busqueda sin resultados')
                continue
            }
            const choices = results.map((res): Choice => {
                return {
                    title: res.label,
                    value: res,
                }
            })
            if (loading.isSpinning) loading.stop()
            const selectResult = <{ manga: SearchResult }>await prompts(searchResultPrompt(choices, choices.length))
            if (!selectResult?.manga){
                 clearScreen()
                 continue
                }
            await loadMangaChapter(server, selectResult.manga.link);
            clearScreen()
        }
    } catch (e) {
        console.log(e)
    }
}

async function loadMangaChapter(server: MangaServerInterface, mangaSrc: string) {
    clearScreen()
    try {
        loading.start(`Cargando capitulos...`);

        const result = await server.getChaptersList(mangaSrc);
        if (!result || result.chapters.length < 0) {
            loading.fail('Error al obtener Capitulos')
            return
        }
        loading.stop();

        const choices = result.chapters.map((e): Choice => {
            return {
                title: e.title,
                value: e
            }
        })

        while (true) {
            const select = await prompts(
                chapterSelect(result.title, choices.length, choices)
            )

            if (!select.chapter) {
                clearScreen()
                break
            }

            loading.start(`cargando ${result.title}...`)
            const chapterInfo = await server.getChapterPages(select.chapter.src)
            if (loading.isSpinning) loading.stop()
            const options = await prompts(searchChapterSelectedOptions)

            if (!options.opt){
                clearScreen()
                continue
                }

            if (options.opt === SignalsCodes.read_chapter) {
                await terminalReader(chapterInfo, server)
            } else if (options.opt === SignalsCodes.download_chapter) {
                await downloadChapter(chapterInfo.mangaTitle, chapterInfo.title, chapterInfo.pages)
            }
            clearScreen()
        }
    } catch (e) {
        if (loading.isSpinning) loading.fail()
        console.log(e)
    }
}

async function history(server: MangaServerInterface) {
    clearScreen()
    const history = History.fetch();

    if (history.length < 1) {
        await prompts({
            type: 'invisible',
            name: 'back',
            message: 'Tu historial esta vacio! ESC para volver al menu anterior'
        })
        return;
    }

    const choices = history.map((e): Choice => {
        return {
            title: e.mangaTitle,
            description: e.title,
            value: e
        }
    })

    while (true) {
        const selected = await prompts(historyPrompt(choices))

        if (!selected?.manga){
            clearScreen()
            break;
        }

        const manga = <ChapterInfo>selected.manga;
        // clearScreen()
        const options = await prompts(historyCahpterSelectedOptions(manga.mangaTitle))

        if (!options.opt){
            clearScreen()
            continue
        }

        if (options.opt === SignalsCodes.read_chapter)
            await terminalReader(manga, server)
        else if (options.opt === SignalsCodes.get_chapters_list)
            await loadMangaChapter(server, manga.main_src);
        else if (options.opt === SignalsCodes.download_chapter)
            await downloadChapter(manga.mangaTitle, manga.title, manga.pages)
        clearScreen()
    }

}

async function populars(server: MangaServerInterface) {
    clearScreen()
    try {
        loading.start('cargando...')
        const populars = await server.getPopulars();
        loading.stop()

        if (!populars || populars.length < 0) {
            await prompts(voidPrompt)
            return;
        }

        const choices = populars.map((popular): Choice => {
            return {
                title: popular.title,
                description: popular.last_chapter.title,
                value: popular
            }
        })

        while (true) {
            const select = await prompts({
                type: 'autocomplete',
                message: chalk.bgHex(PRIMARY_COLOR)(' Populares '),
                name: 'select',
                choices,
                clearFirst: true
            })

            if (!select.select) {
                clearScreen()
                break;
            }
            const info = <PopularManga>select.select
            const option = await prompts(PopularMangaSelectOptions)

            if (!option?.opt) {
                clearScreen()
                continue
            }
            if (option.opt === SignalsCodes.read_chapter) {
                loading.start(`cargando ${info.title} : ${info.last_chapter.title}`)
                const res = await server.getChapterPages(info.last_chapter.src);
                loading.stop();
                await terminalReader(res, server)
            }
            else if (option.opt === SignalsCodes.download_chapter) {
                loading.start(`cargando ${info.title} : ${info.last_chapter.title}`)
                const res = await server.getChapterPages(info.last_chapter.src);
                loading.stop();
                await downloadChapter(res.mangaTitle, res.title, res.pages)
            }
            else if (option.opt === SignalsCodes.get_chapters_list) {
                await loadMangaChapter(server, info.src)
            }
            else if (option.opt === SignalsCodes.exit) {
                clearScreen()
                continue
            }
            clearScreen()
        }

    } catch (e) {
        if (loading.isSpinning) loading.fail('ERROR')
        console.log(e)
    }
}

async function lastedSection(server: MangaServerInterface) {
    clearScreen()
    try {
        loading.start('cargando')
        const mangas = await server.getLastMangas()
        loading.stop()
        if (!mangas || mangas.length < 0) {
            await prompts(voidPrompt)
            return
        }
        const choices = mangas.map((e): Choice => {
            return {
                title: e.title,
                description: e.last_chapters[0].title,
                value: e,
            }
        })
        while (true) {
            const select = await prompts({
                type: 'autocomplete',
                message: chalk.bgHex(PRIMARY_COLOR)(' Ultimos lanzamientos '),
                name: 'manga',
                choices
            })
            if (!select.manga) {
                clearScreen()
                break
            }
            const manga = <LastedManga>select.manga
            const choices2 = manga.last_chapters.map((chapter): Choice => {
                return { title: chapter.title, value: chapter }
            })
            while (true) {
                const select2 = await prompts(chapterSelect(manga.title, choices2.length, choices2))

                if (!select2.chapter) {
                    clearScreen()
                    break
                }
                const chapter = <ChapterMinInfo>select2.chapter
                const chapterOptions = await prompts(searchChapterSelectedOptions)

                if (!chapterOptions.opt) {
                    clearScreen()
                    continue
                }

                loading.start(`cargando ${chapter.title} : ${chapter.title}`)

                const res = await server.getChapterPages(chapter.src);
                loading.stop();
                if (chapterOptions.opt === SignalsCodes.read_chapter)
                    await terminalReader(res, server)
                else if (chapterOptions.opt === SignalsCodes.download_chapter)
                    await downloadChapter(res.mangaTitle, res.title, res.pages)
                else if (chapterOptions.opt === SignalsCodes.exit) {
                    clearScreen()
                    continue
                };
                clearScreen()
            }
        }

    } catch (e) {
        console.log(e)
    }
}