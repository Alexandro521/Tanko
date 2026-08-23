import { Axios, AxiosHeaders } from "axios";
import type { Chapter, ChapterLanguage, ChapterPage, MangaInfo, MangaProvider, ServerName } from "../types/types.js";
import { GET_USER_AGENT } from "../const.ts";
import * as cheerio from "cheerio"
import { extractChapterNumber } from "../utils.ts";

export class MangaPill implements MangaProvider {
    public name: ServerName = 'mangapill';
    private axios!: Axios
    constructor() {
        const headers = new AxiosHeaders()
        headers.set('Host', 'mangapill.com')
        headers.set('Accept-Encoding', 'gzip, deflate, br, zstd')
        headers.setAccept('text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8')
        headers.set('Referer', 'https://mangapill.com/')
        headers.setUserAgent(GET_USER_AGENT())
        this.axios = new Axios({
            baseURL: 'https://mangapill.com/',
            headers: headers
        })
    }
    async search(query: string): Promise<MangaInfo[]> {
        const res = await this.axios.get(`/quick-search?q=${query}`)
        const results: MangaInfo[] = new Array()
        const $ = cheerio.load(res.data)
        $('div.grid a').each((_, anchor) => {
            const mangaSrc = anchor.attribs['href']
            const title = $(anchor).find('div.ml-3 div.flex div.font-black').text()
            const coverSrc = ($(anchor).find('img.object-cover').attr())?.['src'] as string | undefined
            results.push({
                src: mangaSrc,
                title: title,
                coverImage: coverSrc
            })
        })
        return  results
    }
    async getMangaInfo(mangaSrc: string): Promise<MangaInfo> {
        const res = await this.axios.get(mangaSrc)
        const $ = cheerio.load(res.data)
        return {
            src: mangaSrc,
            title: $('div h1').text(),
            coverImage: ($('div.container div.text-transparent img.lazy.object-cover').attr())?.['data-src'],
            description: ($('div.container div.flex div.flex.flex-col div.mb-3 p.text-sm')).text(),
        }
    }
    async getChapterList(mangaSrc: string): Promise<Chapter[]> {
        const res = await this.axios.get(mangaSrc)
        const $ = cheerio.load(res.data)
        const chapters: Chapter[] = new Array()
        $('div#chapters div a').each((index, anchor) => {
            const title = (anchor.attribs['title'] ||'untitled')
            const chapterLang: ChapterLanguage = {
                id: anchor.attribs['href'],
                title: title.trimStart(),
                lang: 'en',
            }
            chapters.push({
                number: extractChapterNumber(title) || index + 1,
                translation_count: 1,
                translations: {
                    en: chapterLang
                },
            })
        })
        return chapters
    }
    async getChapterPages(chapterSrc: string): Promise<ChapterPage[]> {
        const res = await this.axios.get(chapterSrc)
        const $ = cheerio.load(res.data)
        const pages: ChapterPage[] = new Array()
        
        $('img[loading=lazy]').each((index, picture) => {
            const src = picture.attribs['data-src'] || 'https://i.imgur.com/vwceyg5.jpeg'
            pages.push({
                page_index: index.toString(),
                src: src
            })
        })
        return pages
    }
    getPopulars(): Promise<MangaInfo[]> {
        throw new Error("Method not implemented.");
    }
    async getLastMangas(): Promise<MangaInfo[]> {
        const res = await this.axios.get('/chapters')
        const $ = cheerio.load(res.data)
        const results: MangaInfo[] = new Array()
        $('img.lazy[data-src]').each((_, root) => {
            const div = root.parent?.parent?.parent as unknown as cheerio.SelectorType
            const anchor = $(div).find('div.px-1 a.text-secondary')
            const src = (anchor.attr())?.['href'] as string
            const coverImage = root.attribs?.['data-src']
            const title = $(div).find('div.px-1 a.leading-tight.text-secondary div.font-bold').text().trim()
            const description = $(div).find('div.px-1 a div.leading-tight').text()
            results.push(
                {
                    src,
                    title,
                    description,
                    coverImage,
                }
            )
        })
        return results
    }

}
/*
const instance = new MangaPill()
const search = await instance.search('one piece')
const chapters = await instance.getChapterList(search[0].src)
const pages = await instance.getLastMangas()
console.log(JSON.stringify(pages, null, '\t'))
*/