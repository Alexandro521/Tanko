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
        $('main#contenido.py-4 div.container div.row.g-4 div.col-12.col-lg-9 div.row.g-3 > div.col-12').each((_, node) => {
            const root = $('article.lc-release', node)
            const coverContainer = (root.find('a.lc-release-cover'))
            const src = coverContainer.attr('href')!
            const cover = coverContainer.find('img').attr('src')!
            const title = root.find("div.lc-release-body a.lc-release-title").text()
            mangaList.push({
                src,
                title,
                coverImage: cover,
            })
        })
        return mangaList
    }
    async getChapterList(mangaSrc: string): Promise<Chapter[]> {
        const res = await this.axios.get(mangaSrc)
        const $ = cheerio.load(await res.data)
        const chapters: Chapter[] = []
        $('div#chapterList > a.lc-chapter-row').each((i, node) => {
            const anchor = node.attribs['href']!
            const title = $('span.n', node).text()!
            const chapter = extractChapterNumber(title)
            chapters.push({
                number: chapter ?? i,
                translation_count: 1,
                translations: {
                    "es-la": { 
                        lang: "es-la",
                        title,
                        id: anchor
                    }
                }
            })
        })
        return sortChapterList(chapters, 'desc')
    }
    async search(query: string): Promise<MangaInfo[]> {
        const res = await this.axios.get(`/search/?q=${query}`,);
        const data:SearchResult[] = JSON.parse(res.data)
        const mangaList = data.map((e):MangaInfo=>{
            return {
                src: e.uri,
                title: e.name,
                coverImage: e.cover_uri,
            }
        })
        return mangaList
    }
    async getMangaInfo(mangaSrc: string): Promise<MangaInfo> {
        const res = await this.axios.get(mangaSrc)
        const $ = cheerio.load(await res.data)
        const root = $('div.container div.row.g-4 div.col-12.col-lg-9 article.lc-panel.p-3.p-md-4.mb-4 div.row.g-4')
        const title = $(' div.col-7.col-md-9 h1.h3.mb-1', root).text()
        const description = $('div.col-7.col-md-9 p.small.lc-muted.mb-2', root).text()
        const coverImage = $('div.col-5.col-md-3 div.lc-cover-lg img', root).attr('src')
        return {
            title,
            description,
            coverImage,
            src: mangaSrc
        }
    }
    async getChapterPages(chapterSrc: string): Promise<ChapterPage[]> {
        const html = await this.axios.get(chapterSrc)
        const $ = cheerio.load(html.data)
        const pages: ChapterPage[] = []
        $('main.lc-pages#lcPages > img').each((index, imgNode)=>{
            const pageIndex = imgNode.attribs['data-index']
            pages.push({
                page_index: pageIndex || index.toString(),
                src: imgNode.attribs['data-src']
            })
        })
        return pages
    }
    async getPopulars(): Promise<MangaInfo[]> {
        const res = await this.axios.get<string>('');
        const $ = cheerio.load( res.data);
        const Populars: MangaInfo[] = []
        $('div.container div.lc-slider div.lc-slider-track > div.lc-slide').each((__, e) => {
            console.log('ads')
            const titleNode = $('a.lc-slide-name', e)
            const src = titleNode.attr('href') ?? 'null';
            const title = titleNode.text()
            const coverImage = $('a.lc-slide-cover img', e).attr('src')!
            Populars.push({
                title,
                src,
                coverImage: coverImage
            })
        })
        return Populars
    }
}

