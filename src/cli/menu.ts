import esc from 'ansi-escapes';
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
} from "../types/types.js";
import { SignalsCodes } from '../types/enum.js'
import {
    basicChapterOptions,
    generateChapterList,
    historyChapterOptions,
    historySectionPrompt,
    lastedSectionPrompt,
    mainPrompt,
    popularMangaSelectOptions,
    popularSectionPrompt,
    searchPrompt,
    searchResultPrompt,
    voidPrompt
} from './prompts.js';
import {  WELCOME_MESSAGE } from "../const.js";
import { configurationUI } from "./configuration.js";
import { Configuration } from '../functions/configuration.js';
import { int } from 'zod';

const loading = ora();

export const clearScreen = () => {
    console.log(esc.clearViewport);
    console.log(WELCOME_MESSAGE);
}

export async function init() {
    const instace = await Configuration.getInstance()
    let server = instace.getClient()
    let config = instace.configuration
    console.log(WELCOME_MESSAGE)
    instace.on('load', ()=>{
        server = instace.getClient()
        config = instace.configuration
    })
    try {
        if(!server && config.client.need_browser) throw new Error('Error al intentar obtener el cliente')

        while (true) {
            console.log()
            const main = await prompts(mainPrompt())
            if (!main?.target) {
                await instace.closeBrowser();
                break
            }

            if (main.target === SignalsCodes.search_section)
                await searchBar(server)
            else if (main.target === SignalsCodes.history_section)
                await history(server)
            else if (main.target === SignalsCodes.popular_section)
                await populars(server)
            else if (main.target === SignalsCodes.configuration_section) 
                await configurationUI()
            else if (main.target === SignalsCodes.lasted_section)
                await lastedSection(server)
            else if (main.target === SignalsCodes.exit) {
                await instace.closeBrowser()
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
            const searchQuery = await prompts(searchPrompt())
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
            clearScreen()
            const selectResult = await prompts(searchResultPrompt(choices))

            if (!selectResult?.target){
                clearScreen()
                continue
            }
            await loadMangaChapter(server, selectResult.target.link);
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
                generateChapterList(result.title, choices.length, choices)
            )

            if (!select.chapter) {
                clearScreen()
                break
            }

            loading.start(`cargando ${result.title}...`)
            const chapterInfo = await server.getChapterPages(select.chapter.src)
            if (loading.isSpinning) loading.stop()
            clearScreen()
            const options = await prompts(basicChapterOptions())

            if (!options.target){
                clearScreen()
                continue
                }

            if (options.target === SignalsCodes.read_chapter) {
                await terminalReader(chapterInfo, server)
            } else if (options.target === SignalsCodes.download_chapter) {
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
        await prompts(voidPrompt('No hay historial'))
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
        const selected = await prompts(historySectionPrompt(choices))

        if (!selected?.target){
            clearScreen()
            break;
        }

        const manga = <ChapterInfo>selected.target;
        // clearScreen()
        const options = await prompts(historyChapterOptions(manga.mangaTitle))

        if (!options.target){
            clearScreen()
            continue
        }

        if (options.target === SignalsCodes.resume_read)
            await terminalReader(manga, server)
        else if (options.target === SignalsCodes.get_chapters_list)
            await loadMangaChapter(server, manga.main_src);
        else if (options.target === SignalsCodes.download_chapter)
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
            await prompts(voidPrompt('No se encontraron mangas populares'))
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
            const select = await prompts(popularSectionPrompt(choices))

            if (!select.target) {
                clearScreen()
                break;
            }
            clearScreen()
            const info = <PopularManga>select.target
            const option = await prompts(popularMangaSelectOptions(info.title))

            if (!option?.target) {
                clearScreen()
                continue
            }
            if (option.target === SignalsCodes.read_chapter) {
                loading.start(`cargando ${info.title} : ${info.last_chapter.title}`)
                const res = await server.getChapterPages(info.last_chapter.src);
                loading.stop();
                await terminalReader(res, server)
            }
            else if (option.target === SignalsCodes.download_chapter) {
                loading.start(`cargando ${info.title} : ${info.last_chapter.title}`)
                const res = await server.getChapterPages(info.last_chapter.src);
                loading.stop();
                await downloadChapter(res.mangaTitle, res.title, res.pages)
            }
            else if (option.target === SignalsCodes.get_chapters_list) {
                await loadMangaChapter(server, info.src)
            }
            else if (option.target === SignalsCodes.exit) {
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
            await prompts(voidPrompt('No se encontraron mangas recientes'))
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
            const select = await prompts(lastedSectionPrompt(choices))
            if (!select.target) {
                clearScreen()
                break
            }
            const manga = <LastedManga>select.target

            const choices2 = manga.last_chapters.map((chapter): Choice => {
                return { title: chapter.title, value: chapter }
            })
            while (true) {
                const select2 = await prompts(generateChapterList(manga.title, choices2.length, choices2))

                if (!select2.chapter) {
                    clearScreen()
                    break
                }
                const chapter = <ChapterMinInfo>select2.chapter
                const chapterOptions = await prompts(basicChapterOptions())

                if (!chapterOptions.target) {
                    clearScreen()
                    continue
                }

                loading.start(`cargando ${chapter.title} : ${chapter.title}`)

                const res = await server.getChapterPages(chapter.src);
                loading.stop();
                if (chapterOptions.target === SignalsCodes.read_chapter)
                    await terminalReader(res, server)
                else if (chapterOptions.target === SignalsCodes.download_chapter)
                    await downloadChapter(res.mangaTitle, res.title, res.pages)
                else if (chapterOptions.target === SignalsCodes.exit) {
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