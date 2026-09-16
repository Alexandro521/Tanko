import type { Page } from "playwright";
import * as cheerio from "cheerio"
import { Axios } from "axios";
import { extractChapterNumber, sortChapterList } from "../utils.ts";
import type {
    Chapter,
    ChapterPage,
    ServerName,
    MangaProvider,
    SearchResult,
    MangaInfo
} from "../types/types.ts"

export class LeerCapitulo implements MangaProvider {
    private page: Page
    private axios = new Axios({baseURL: "https://www.leercapitulo.co", method: 'GET'})
    public name: ServerName = "leercapitulo";
    private baseUrl = "https://www.leercapitulo.co"

    constructor(pageContext: Page) {
        this.page = pageContext
    }

    async getLastMangas(): Promise<MangaInfo[]> {
        const mangaList: MangaInfo[] = []
        const req = await fetch(this.baseUrl);
        if (!req.ok) throw new Error(`Error at provider.getLastMangas(): ${req.statusText} http status code: ${req.status}`)
        const $ = cheerio.load( await req.text() );
        $('section.bodycontainer div.row div.col-md-8 div.row > div.col-md-6').each((_, node) => {
            const container = $('div.mainpage-manga div.media-body', node)
            const mangaTtitle = container.find('h4.manga-newest').text()
            const src = container.find('a').first().attr('href') ?? ''
            const lastChapter_title = container.find('div.hotup-list > span').first().find('a.xanh').text()
            mangaList.push({ title: mangaTtitle, src, description: lastChapter_title})
        })
        return mangaList
    }
    async getChapterList(mangaSrc: string): Promise<Chapter[]> {
        const res = await this.axios.get(this.baseUrl + mangaSrc)
        const $ = cheerio.load(await res.data)
        const chapters: Chapter[] = []
        $('div.chapter-list ul > li').each((i, node) => {
            const anchor = $(node).find('a.xanh')
            const chapter = extractChapterNumber(anchor.attr('title') ?? '')
            chapters.push({
                number: chapter ?? i,
                translation_count: 1,
                translations: {
                    "es-la": { 
                        lang: "es-la",
                        title: anchor.text(),
                        id: anchor.attr('href') ?? ''
                    }
                }
            })
        })
        return sortChapterList(chapters, 'desc')
    }
    async search(query: string): Promise<MangaInfo[]> {
        const res = await this.axios.get(`/search-autocomplete?term=${query}`,);
        const data:SearchResult[] = JSON.parse(res.data)
        const mangaList = data.map((e):MangaInfo=>{
            return {
                src: e.link,
                title: e.label ?? e.value,
                description: e.value
            }
        })
        return mangaList
    }
    async getMangaInfo(mangaSrc: string): Promise<MangaInfo> {
        const res = await this.axios.get(this.baseUrl + mangaSrc)
        const $ = cheerio.load(await res.data)
        const title = $('h1.title-manga').text()
        return {
            title,
            src: mangaSrc
        }
    }
    async getChapterPages(chapterSrc: string): Promise<ChapterPage[]> {
        const page = this.page
        const url = this.baseUrl+chapterSrc 
        await page.goto(url, {waitUntil: 'domcontentloaded'})
        const body = await  page.innerHTML('html')
        const pages: ChapterPage[] = []
        if (body) {
            const $ = cheerio.load(body)
            const pagesContainer = $('div.each-page div.chapter-content-inner div.comic_wraCon')
            $(pagesContainer).find('a').each((index, element) => {
                const imgAttributes = $(element).find('img').attr()
                const pageAttr = $(element).attr()
                //@ts-ignore
                const pageNumber = pageAttr['data-page'] ?? pageAttr['name'] ?? String(index+1)
                //@ts-ignore
                const imageSrc = imgAttributes['data-original'] ?? imgAttributes['src'] ?? imgAttributes['data-src']
                pages.push({
                    page_index: pageNumber,
                    src: imageSrc
                })
            })
        }
        return pages
    }
    async getPopulars(): Promise<MangaInfo[]> {
        const res = await this.axios.get<string>('');
        const $ = cheerio.load( res.data);
        const Populars: MangaInfo[] = []
        $('div.update-list div div > .hot-manga').each((__, e) => {
            const titleNode = $(e).find('div.caption a h3.manga-title')
            const src = $(titleNode.parent()).attr('href') ?? 'null';
            
            const title = titleNode.text()
            Populars.push({
                title,
                src
            })
        })
        return Populars
    }
}



