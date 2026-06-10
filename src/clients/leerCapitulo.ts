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
            const chapterList: Chapter[] = []
            container.find('div.hotup-list > span').each((_, span) => {
                const chapterSrc = $('a.xanh', span)
                const chapter: Chapter = {
                    id: 'null',
                    title: chapterSrc.text() ?? '',
                    translation_count: 1,
                    translations: {es: { lang: 'es', src: chapterSrc.attr('href') ?? 'null', title: chapterSrc.text()}
                    }
                }
                chapterList.push(chapter)
            })
            mangaList.push({ title: mangaTtitle, src, chapters: sortChapterList(chapterList) })
        })
        return mangaList
    }

    async search(query: string): Promise<SearchResult[]> {
        const res = await this.axios.get(`/search-autocomplete?term=${query}`,);
        const json: SearchResult[] = JSON.parse(res.data)
        return json
    }
    async getMangaInfo(mangaSrc: string): Promise<MangaInfo> {
        const res = await fetch(this.baseUrl + mangaSrc)
                if (!res.ok) {
            throw new Error('red failed');
        }
        const $ = cheerio.load(await res.text())
        const title = $('h1.title-manga').text()
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
        return {
            title,
            src: mangaSrc,
            chapters: sortChapterList(chapters)
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
            const chapterNode = $(e).find('div.caption a.Chapter')
            const src = $(titleNode.parent()).attr('href') ?? 'null';
            const title = titleNode.text()
            const chapterTitle = chapterNode.find('p.chapter').text()
            const chapterSrc = chapterNode.attr('href') ?? 'null'
            const ch: Chapter = {
                title: chapterTitle,
                id: chapterSrc,
                translation_count: 1,
                translations: {es: {lang: 'es', title: chapterTitle, src: chapterSrc}}

            }
            Populars.push({
                title,
                src,
                chapters: [ch]
            })
        })
        return Populars
    }
}



