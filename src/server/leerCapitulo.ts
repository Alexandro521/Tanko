import type { Page } from "playwright";
import * as cheerio from "cheerio"
import type { 
    Chapter,
    ChapterInfo,
    ChapterMinInfo,
    LastedManga,
    MangaServerInterface,
    PopularManga,
    SearchResult,} from "../types.js"

export class MangaServerClient implements MangaServerInterface {
    private page: Page
    private baseUrl = "https://www.leercapitulo.co"
    constructor(pageContext: Page){
        this.page = pageContext
    }
    async getLastMangas(): Promise<LastedManga[] | undefined> {
        try {
            const manga: LastedManga[] = []
            const html = await fetch('https://www.leercapitulo.co/');
            if(!html.ok) throw new Error('Erro wiht network')
            const $ = cheerio.load(await html.text());
            $('section.bodycontainer div.row div.col-md-8 div.row > div.col-md-6').each((index, node) => {
                const root = $('div.mainpage-manga div.media-body', node)
                const title = root.find('h4.manga-newest').text()
                const src = root.find('a').first().attr('href') ?? ''
                const last_chapters: ChapterMinInfo[] = []
                root.find('div.hotup-list > span').each((index, span) => {
                    const anchor = $('a.xanh', span)
                    last_chapters.push({
                        title: anchor.text() ?? '',
                        src: anchor.attr('href') ?? ''
                    })
                })
                manga.push({ title, src, last_chapters })
            })
            return manga
        } catch (error) {

        }
    }
    async search(query: string): Promise<SearchResult[]> {
        const res = await fetch(`https://www.leercapitulo.co/search-autocomplete?term=${query}`);
        const json: SearchResult[] = await res.json()
        return json
    }
    async getChaptersList(mangaSrc: string) {
        try{
        const html = await fetch(this.baseUrl+mangaSrc)
        if(!html.ok) {
            throw new Error('red failed');
        }
        const $ = cheerio.load(await html.text())
        const title = $('h1.title-manga').text()
        const chapters: Chapter[] = []

        $('div.chapter-list ul > li').each((i,node)=>{

        const anchor = $(node).find('a.xanh')
        chapters.push({
            id: i.toString(),
            src: anchor.attr('href') ?? '',
            title: anchor.text()
        })
        })
        return {
            title,
            chapters
        }
    }catch(e){
        console.log(e);
    }
    }
    async getChapterPages(chapterSrc: string): Promise<ChapterInfo>{
                await this.page.goto(this.baseUrl + chapterSrc);
                let pagesNodes = await this.page.locator('.each-page a').all();
                let title = await this.page.locator('h1').innerText()
                let mainInfo = this.page.locator("div.container_title h2.chapter-title").nth(1).locator('a').first()
                let nexChapterLocator = this.page.locator('div.select_page_1 a.next')
                let prevChapterLocator  = this.page.locator('div.select_page_1 a.pre')
                let nextChapter =  (await nexChapterLocator.isVisible()) ? await nexChapterLocator.getAttribute('href') ?? null : null
                let prevChapter =  (await prevChapterLocator.isVisible()) ? await prevChapterLocator.getAttribute('href') ?? null : null
            
                //  spin.text = `fetching pages [0/${pages.length}]`
                const pages =  await Promise.all(
                        pagesNodes.map(async page => {
                        return {
                            src: await page.locator('img').getAttribute('data-src') ?? 'undefined',
                            page_index: await page.getAttribute('data-page') ?? '0'
                        }
                    }
            ))
            return {
                    title,
                    mangaTitle: await mainInfo.getAttribute('title') ?? '',
                    main_src: await  mainInfo.getAttribute('href') ?? '',
                    src: chapterSrc,
                    nextChapter,
                    prevChapter,
                    pages,
            }
    }
    async getPopulars():Promise<PopularManga[] | undefined> {
        try {
            const html = await fetch('https://www.leercapitulo.co/');
            if (!html.ok) throw new Error('Error al intentar obtener Populares');

            const $ = cheerio.load(await html.text());
            const Populars: PopularManga[] = []
            $('div.update-list div div > .hot-manga').each((index, e) => {
                const titleNode = $(e).find('div.caption a h3.manga-title')
                const chapterNode = $(e).find('div.caption a.Chapter')
                const src = $(titleNode.parent()).attr('href') ?? '';
                const title = titleNode.text()
                const last_chapter = {
                    title: chapterNode.find('p.chapter').text(),
                    src: chapterNode.attr('href') ?? ''
                }
                Populars.push({
                    title,
                    src,
                    last_chapter
                })
            })
            return Populars
        } catch (e) {
            console.log(e)
        }
    }
}



