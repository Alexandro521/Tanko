import type { Page } from "playwright";
import * as cheerio from "cheerio"
import { Axios } from "axios";
import { sortChapterList } from "../utils.js";
import type {
    Chapter,
    ChapterPage,
    ServerName,
    MangaProvider,
    SearchResult,
    MangaInfo
} from "../types/types.js"
import { json } from "stream/consumers";

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
            const lastChapter = container.find('div.hotup-list > span').first().find('a.xanh').text()
            mangaList.push({ title: mangaTtitle, src, description: lastChapter})
        })
        return mangaList
    }
    async getChapterList(mangaSrc: string): Promise<Chapter[]> {
        const res = await this.axios.get(this.baseUrl + mangaSrc)

        const $ = cheerio.load(await res.data)
        const chapters: Chapter[] = []
        $('div.chapter-list ul > li').each((i, node) => {
            const anchor = $(node).find('a.xanh')
            chapters.push({
                id: i.toString(),
                translation_count: 1,
                title: anchor.text(),
                translations: {
                    "es-la": { lang: "es-la", title: anchor.text(), src: anchor.attr('href') ?? ''}
                }
            })
        })
        return sortChapterList(chapters)
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
        await this.page.goto(this.baseUrl + chapterSrc);
        let pagesNodes = await this.page.locator('.each-page a').all();
        const pages = await Promise.all(
            pagesNodes.map(async page => {
                return {
                    src: await page.locator('img').getAttribute('data-src') ?? 'undefined',
                    page_index: await page.getAttribute('data-page') ?? '0'
                }
            }
            ))
        return pages
    }
    async getPopulars(): Promise<MangaInfo[]> {

        const res = await this.axios.get<string>('');
        const $ = cheerio.load( res.data);
        const Populars: MangaInfo[] = []
        $('div.update-list div div > .hot-manga').each((index, e) => {
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



