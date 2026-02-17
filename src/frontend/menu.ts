import type {  Browser, BrowserContext, Page } from "playwright";
import esc from 'ansi-escapes';
import boxen from "boxen";
import ora from "ora";
import prompts,  { type Choice } from "@alex_521/prompts";
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
import {SignalsCodes} from '../types.js'
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
import { WELCOME_MESSAGE } from "../const.js";


const loading = ora();

/*
const box =  boxen('tanko reader CLI',
        {
            padding: 1,
            title: 'Welcome!',
            titleAlignment: 'center',
            textAlignment: 'center',
            borderStyle: 'round',
            borderColor: 'yellowBright',
            fullscreen: false
})*/

export async function init(server: MangaServerInterface, browser: BrowserContext, page: Page) {
    try {
        const closeBrowser = async ()=>{
            loading.start('Saliendo...')
           // await context.storageState({path: 'src/data/browser_storage.json'})
            await page.close()
            await browser.close()
            loading.stop()
        }

        while(true){
            console.log(WELCOME_MESSAGE)
            const main = await prompts(mainPrompt)

            if(!main?.opt) {
                await closeBrowser();
                break
            }

            if(main.opt === SignalsCodes.search_section)
                await searchBar(server)
            else if(main.opt === SignalsCodes.history_section)
                await history(server)
            else if(main.opt === SignalsCodes.popular_section)
                await populars(server)
            else if(main.opt === SignalsCodes.lasted_section)
                await lastedSection(server)
            else if(main.opt === SignalsCodes.exit){
                closeBrowser()
                break
            }
            console.log(esc.clearViewport)
        }
    } catch (e) {
        console.log(e)
    }
}

async function searchBar(server: MangaServerInterface){
    try{
        while(true){
            const searchQuery = await prompts(search)
            if(!searchQuery?.query) break

            loading.start(`Buscando ${searchQuery.query}...`)
            const results = await server.search(searchQuery.query)

            if(results.length < 1) {
                loading.fail('Busqueda sin resultados')
                continue
            }
            const choices =  results.map((res): Choice => {
            return {
                title: res.label,
                value: res,
            }
        })

            if(loading.isSpinning) loading.stop()
             const selectResult = < {manga: SearchResult}>  await prompts(searchResultPrompt(choices, choices.length))
             if(!selectResult?.manga) continue
             await loadMangaChapter(server, selectResult.manga.link);
             console.log(esc.clearViewport)
             console.log(box)
    }

    }catch(e){
        console.log(e)                                    
    }
}

async function loadMangaChapter(server: MangaServerInterface, mangaSrc: string) {
    try{
        loading.start(`Cargando capitulos...`);

        const result = await server.getChaptersList(mangaSrc);
        if(!result || result.chapters.length < 0){
            loading.fail('Error al obtener Capitulos')
            return
        }
        loading.stop();

        const choices =  result.chapters.map((e):Choice=>{
            return {
                title: e.title,
                value: e
            }
        })

        while(true){

            const select = await prompts(
                chapterSelect(result.title, choices.length, choices)
            )

            if(!select.chapter) break;

            loading.start(`cargando ${result.title}...`)
            const chapterInfo = await server.getChapterPages(select.chapter.src)
            if(loading.isSpinning) loading.stop()
            const options = await prompts(searchChapterSelectedOptions)

            if(!options.opt) continue
            
            if(options.opt === SignalsCodes.read_chapter ){
                await terminalReader(chapterInfo, server )
            }else if(options.opt === SignalsCodes.download_chapter){
                await downloadChapter(chapterInfo.mangaTitle, chapterInfo.title, chapterInfo.pages)
            }
        }
    }catch(e){
        if(loading.isSpinning) loading.fail()
        console.log(e)
    }
}

async function history(server: MangaServerInterface) {

    const history = History.fetch();

    if (history.length < 1) {
        await prompts({
            type: 'invisible',
            name: 'backOf',
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

        if (!selected?.manga) 
            break;

        const manga = <ChapterInfo> selected.manga;
        const options = await prompts(historyCahpterSelectedOptions(manga.mangaTitle))

        if (!options.opt) 
            continue;

        if (options.opt === SignalsCodes.read_chapter) 
            await terminalReader(manga, server)
        else if (options.opt === SignalsCodes.get_chapters_list)
            await loadMangaChapter(server, manga.main_src);
        else if (options.opt === SignalsCodes.download_chapter)
            await downloadChapter(manga.mangaTitle, manga.title, manga.pages)
    }

}

async function populars(server: MangaServerInterface) {
    try{
        loading.start('cargando...')
        const populars = await server.getPopulars();
        loading.stop()

        if (!populars || populars.length < 0) {
            await prompts(voidPrompt)
            return;
        }

        const choices = populars.map((popular):Choice=>{
            return {
                title: popular.title,
                description: popular.last_chapter.title,
                value: popular
            }
        })

        while(true){
            const select =  await prompts({
                type:'autocomplete',
                message: 'Populares',
                name: 'select',
                choices,
                clearFirst: true
            })

            if(!select.select){
                break;
            }
            const info = <PopularManga> select.select
            const option = await  prompts(PopularMangaSelectOptions)
            if(!option?.opt){
                console.log(esc.clearViewport)
                console.log(box)
                continue
            }
            if(option.opt === SignalsCodes.read_chapter )
            {
                loading.start(`cargando ${info.title} : ${info.last_chapter.title}`)
                const res = await server.getChapterPages(info.last_chapter.src);
                loading.stop();
                await terminalReader( res, server)
            }
            else if (option.opt === SignalsCodes.download_chapter)
            {
                loading.start(`cargando ${info.title} : ${info.last_chapter.title}`)
                const res = await server.getChapterPages(info.last_chapter.src);
                loading.stop();
                await downloadChapter(res.mangaTitle, res.title, res.pages)
            }
            else if(option.opt === SignalsCodes.get_chapters_list)
            {
                await loadMangaChapter(server, info.src)
            }
            else if(option.opt === SignalsCodes.exit)
            {
                continue
            }
        }

    }catch(e){
        if(loading.isSpinning) loading.fail('ERROR')
        console.log(e)
    }
}

async function lastedSection(server: MangaServerInterface) {
    try{
        loading.start('cargando')
        const mangas = await server.getLastMangas()
        loading.stop()
        if(!mangas){
            await prompts(voidPrompt)
            return
        }else if(mangas.length < 1){
            await prompts(voidPrompt)
            return
        }
        const choices = mangas.map((e):Choice=>{
            return {
                title: e.title,
                description: e.last_chapters[0].title,
                value: e,
            }
        })
        while(true) {
            const select = await prompts({
                type:'select',
                message: 'Mas recientes',
                name: 'manga',
                choices
            })
            if(!select.manga) break
            const manga = <LastedManga> select.manga
            const choices2 = manga.last_chapters.map((chapter):Choice =>{
                return {title: chapter.title, value: chapter}
            })
            while (true){
                const select2 = await prompts(chapterSelect(manga.title,choices2.length, choices2))
                if(!select2.chapter) break
                const chapter = <ChapterMinInfo> select2.chapter
                const chapterOptions = await prompts(searchChapterSelectedOptions)
                if(!chapterOptions.opt) continue

                loading.start(`cargando ${chapter.title} : ${chapter.title}`)
                const res = await server.getChapterPages(chapter.src);
                loading.stop();
                if(chapterOptions.opt  === SignalsCodes.read_chapter)
                    await terminalReader(res,server)
                else if(chapterOptions.opt === SignalsCodes.download_chapter)
                    await downloadChapter(res.mangaTitle, res.title, res.pages)
                else if(chapterOptions.opt === SignalsCodes.exit) continue;
            }
            console.log(esc.clearViewport)
        }

    }catch(e){
        console.log(e)
    }
}