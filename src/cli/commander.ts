import { Command, Option } from "commander";
import { mangaServerRegister } from "../servers/port.ts";
import type { Chapter, MangaInfo } from "../types/types.js";
import { Downloader } from "../functions/downloader.ts";
import { DOWNLOADS_DEFAULT_DIR } from "../const.ts";
import { sortChapterList, extractChapterSrcByLang,  } from "../utils.ts";
import ora from 'ora'

const LOADER = ora()
const avaliblesProviders = mangaServerRegister.map(e => e.name ) 
export const program = new Command()

const providerOption = new Option('-p,--provider <string>', 'The manga provider to use, the default value is mangadex').choices(avaliblesProviders).default('mangadex') 
const sortOrderOption = new Option('-s,--sort <string>', 'order of results').choices(['asc', 'desc']).default('desc')
const limitOptions = new Option('-l,--limit <number>', 'limit the number of results').default(9999)
const offsetOption = new Option('-o,--offset <number>', 'initial offset in the results list').default(0)
const lexicographicSort = (a:string, b:string) =>{
    const minLength = Math.min(a.length, b.length)
    let e = 0
    for(let i = 0; i < minLength; i++){
        e = a.charCodeAt(i) - b.charCodeAt(i)
        if(e !== 0) break
    }
    return e
}
const parseMangaInfoArray = (result: MangaInfo[] | Chapter[], opts: any)=>{
    const offset = Math.min(parseInt(opts.offset), result.length)
    const limit = Math.min(result.length, (parseInt(opts.limit)+offset))
    if('title' in result[0]){
        switch(opts.sort){
            case 'desc': 
            (result as MangaInfo[]).sort((a,b)=> lexicographicSort(a.title, b.title))
            break
        case 'asc': 
            (result as MangaInfo[]).sort((a,b)=> lexicographicSort(b.title, a.title))
            break
        }
    }else {
        result = sortChapterList(result as Chapter[], opts.sort)
    }
    return result.slice(offset, limit)
}

program.name('Tanko')
.description('Manga reader at the terminal')
.version('2.1.1')


program.command('search')
.description('search mangas by name')
.argument('<string>', 'search query')
.addOption(providerOption)
.addOption(limitOptions)
.addOption(sortOrderOption)
.addOption(offsetOption)
.action(async (str, opts)=>{
    const providerProps = mangaServerRegister.find(e=> e.name === opts.provider)!
    if(providerProps.need_browser) {
        console.warn('Manga providers that require a browser are not compatible with the command line.')
        return
    }
    //@ts-ignore
    const provider = (await providerProps.client(undefined))
    const result = await provider.search(str)
    const parseArray = parseMangaInfoArray(result, opts) as MangaInfo[]
    console.log(parseArray.map((e, i)=>{
        return `${i+1} | ${e.title} | ${e.src}`
    }).join('\n'))
})

program.command('chapter')
.description('Get a list of chapters using the manga ID')
.argument('<string>', 'manga src')
.addOption(providerOption)
.addOption(limitOptions)
.addOption(sortOrderOption)
.addOption(offsetOption)
.option('-t,--lang <string>', 'preferred language', 'en')
.option('-d,--download', 'download the results')
.addOption(new Option('-f,--format <sring>', 'download format').choices(['pdf', 'cbz', 'zip', 'imgs']).default('pdf'))
.addOption(new Option('-x,--output <path>', 'save path').default(DOWNLOADS_DEFAULT_DIR))
.action(async (str, opts)=>{
    const providerProps = mangaServerRegister.find(e=> e.name === opts.provider)!
    if(providerProps.need_browser) {
        console.warn('Manga providers that require a browser are not compatible with the command line.')
        return
    }
    //@ts-ignore
    const provider = (await providerProps.client(undefined))
    const mangaInfo = await provider.getMangaInfo(str)
    if(!mangaInfo) throw new Error('Invalid manga ID')
    const result = await provider.getChapterList(str)
    const parseArray = parseMangaInfoArray(result, opts) as Chapter[]
    const translatedChapters = parseArray.map(e=>{
            const ch = extractChapterSrcByLang(e, opts.lang)
            return {
                ...e,
                target: ch
            }
    })
    process.stdout.write(`title: ${mangaInfo.title} chapters: ${result.length} \n`)
    translatedChapters.forEach((e, i)=>{
        process.stdout.write(`${i}  |  ${e.number}  |  ${e.target.title}  |  ${e.target.lang}  |  ${e.target.id}\n`)
    })
    if(opts.download){
        const dw = Downloader.getInstance()
        let pagesCount = 0
        let pagesLength  = 0
        let currentChapter = 0
        process.on('SIGKILL', process.exit)
        dw.on('download_page', () => {
            pagesCount++;
            let info = translatedChapters[currentChapter]
            LOADER.text = `Downloading ${info.target.title} [${info.target.lang.toUpperCase()}] - ${((pagesCount*100)/pagesLength).toFixed(1)}%`
        })
        dw.on('done', () => {
            LOADER.succeed('Successful download')
            pagesCount = 0;
            pagesLength = 0;
        })
        dw.on('state', (state) => {
            if (LOADER.isSpinning)
                LOADER.text = state + '...'
        })

        for(let i = 0; i < translatedChapters.length; i++){
            try{
                if(!LOADER.isSpinning) LOADER.start()
                const chapter = translatedChapters[i]
                const pages = await provider.getChapterPages(chapter.target.id)
                pagesLength = pages.length
                currentChapter = i;
                await dw.download({
                    serverName: provider.name,
                    chapterTitle: chapter.target.title,
                    format: opts.format,
                    mangaTitle:  mangaInfo.title,
                    pages: pages
                })
            }catch(e){
                if(LOADER.isSpinning){
                    LOADER.fail('Download failed')
                }
                if(e instanceof Error){
                    console.log(e.message)
                }
            }
        }
    }
})