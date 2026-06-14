import type { ChapterListMangadex } from "../types/mangadex/get_chapters.js";
import type {
    MangaProvider,
    Chapter,
    HistoryObject,
    SearchResult,
    ChapterPage,
    ChapterLangType,
    ServerName,
    MangaInfo
} from "../types/types.js";
import axios from "axios";
import fs from 'fs/promises'
import type { MangadexMangaInfo, SearchResultMangadex } from "../types/mangadex/search.js";
import type { Puzzle } from "../types/mangadex/get_pages.js";
interface Chapter_ extends Chapter {
    index: number | string
}
enum MangaOrderEnum  {
    asc = 'asc',
    desc = 'desc'
}
interface ChapterOrderOptions {
    createdAt?: MangaOrderEnum,
    updatedAt?: MangaOrderEnum,
    publishAt?: MangaOrderEnum,
    readableAt?: MangaOrderEnum,
    volume?: MangaOrderEnum,
    chapter?: MangaOrderEnum,
}
interface MangaOrderOptions {
    title?: MangaOrderEnum,
    year?: MangaOrderEnum,
    createdAt?: MangaOrderEnum,
    updatedAt?: MangaOrderEnum,
    latestUploadedChapter?: MangaOrderEnum,
    followedCount?: MangaOrderEnum,
    relevance?: MangaOrderEnum
}
interface GetProps {
    order: MangaOrderOptions | ChapterOrderOptions,
    maxGet: number,
    chapterRequestStepSize: number,
    maxChapterRequest: number
}
export class MangaDex implements MangaProvider {
    public name: ServerName = "mangadex"
    private baseUrl = 'https://api.mangadex.org'
    private chapterOrder: Object;
    constructor(){
        this.chapterOrder = this.serializeOrderObject({
            chapter: MangaOrderEnum.desc,
        })
        
    }
    
    async search(query: string): Promise<MangaInfo[]> {

        const { data } = await axios.get<SearchResultMangadex>(`${this.baseUrl}/manga`, {
            params: {
                "title": query,
            }
        })
        return data.data.map((e): MangaInfo => {
            return {
                title: e.attributes.title.en ?? Object.values(e.attributes.title)[0],
                src: e.id,
                description: e.attributes.description.en ?? Object.values(e.attributes.description)[0]
            }
        })
    }
    async getChapterList(mangaSrc: string, chapterRequestSize = 300, chapterReqLimit=9999): Promise<Chapter[]> {
        let chapterOffset = 0
        let chapters:ChapterListMangadex['data'] = [];
        const params = {
            'limit': chapterRequestSize,
            'offset': chapterOffset,
            'includeExternalUrl': 0,
            'includeEmptyPages': 0,
            'includeFuturePublishAt': 0,
            ...this.chapterOrder
        }
        while (true) {
            const res = await axios.get<ChapterListMangadex>(
                `${this.baseUrl}/manga/${mangaSrc}/feed`, {params});
            chapters.push(...res.data.data);
            const chapterLimit = Math.min(res.data.total, chapterReqLimit)
            if (chapters.length >=  chapterLimit)
                break;
            chapterOffset += Math.min(chapterRequestSize, chapterLimit - chapters.length);
        }
        const chapterMap = new Map<string, number>()
        const chapterList: Chapter_[] = []
        /**Adjuntar todas las variantes de idioma en una sola unidad */
        for (const chapterData of chapters) {
            const chapterNumber = chapterData.attributes.chapter ?? ''
            const chapterLang = chapterData.attributes.translatedLanguage as ChapterLangType
            const title =
                `Chapter ${chapterData.attributes.chapter}` +
                `${chapterData.attributes.title != null ? ': ' + chapterData.attributes.title : ''}`
    
            if (chapterMap.has(chapterNumber)) {
    
                const target = chapterList[chapterMap.get(chapterNumber) ?? 0];
                target.translation_count++
                target.translations[chapterLang] = {
                    title,
                    lang: chapterLang,
                    src: chapterData.id
                }
                continue
            }
    
            const chapterInfo: Chapter_ = {
                title,
                translation_count: 1,
                translations: {},
                id: chapterData.id,
                index: chapterNumber,
            }
    
            chapterInfo.translations[chapterLang] = {
                title,
                lang: chapterLang,
                src: chapterData.id
            }
            chapterList.push(chapterInfo)
            chapterMap.set(chapterNumber, chapterList.length - 1)
        }

        return chapterList
    }
    async getMangaInfo(mangaSrc: string): Promise<MangaInfo> {
        const {data} =  await axios.get<MangadexMangaInfo>(`${this.baseUrl}/manga/${mangaSrc}`)
        const {attributes, id} = data.data
        return {
            title: Object.values(attributes.title)[0] ?? 'No title',
            src: id,
            description: Object.values(attributes.description)[0] ?? 'No title',
            lastUploadChapterSrc: attributes.latestUploadedChapter
        }
    }
    async getChapterPages(chapterSrc: string): Promise<ChapterPage[]> {
        const res = await axios.get<Puzzle>(`${this.baseUrl}/at-home/server/${chapterSrc}`)
        const { baseUrl, chapter } = res.data
        const pages = chapter.data.map((e, i): ChapterPage => {
            return {
                page_index: i.toString(),
                src: `${baseUrl}/data/${chapter.hash}/${e}`
            }
        })
        return pages
    }
    private serializeOrderObject(order: MangaOrderOptions | ChapterOrderOptions) {
        const finalOrderQuery: {[key: string]: MangaOrderEnum} = {};
        // { "order[rating]": "desc", "order[followedCount]": "desc" }
        for (const [key, value] of Object.entries(order)) {
        finalOrderQuery[`order[${key}]`] = value;
        }
        return finalOrderQuery
    }
    private async generalizeMangaGet(props:GetProps): Promise<MangaInfo[]>{
        const orderQuery = this.serializeOrderObject(props.order)
        const res = await axios.get<SearchResultMangadex>(`${this.baseUrl}/manga`,{
            params: {
                'limit': props.maxGet,
                'offset': 0,
                ...orderQuery
            }
        })
        const mangaList = res.data.data.map((e):MangaInfo   =>{
            const {attributes} = e
            return {
                title: Object.values(attributes.title)?.[0] ?? 'no title',
                src: e.id,
                description: Object.values(attributes.description)?.[0] ?? 'no description',
                lastUploadChapterSrc: attributes.latestUploadedChapter
            }
        })
        return mangaList
    }
    async getPopulars(): Promise<MangaInfo[]> {
        const order:MangaOrderOptions = {
            followedCount: MangaOrderEnum.desc,
            relevance: MangaOrderEnum.desc
        }
        return await this.generalizeMangaGet({
            order,
            chapterRequestStepSize: 1,
            maxChapterRequest: 1,
            maxGet: 60
        })
    }
    async getLastMangas(): Promise<MangaInfo[]> {
        const order:MangaOrderOptions = {
            latestUploadedChapter: MangaOrderEnum.desc,
            updatedAt: MangaOrderEnum.desc,
        }
        return await this.generalizeMangaGet({
            order,
            chapterRequestStepSize: 10,
            maxChapterRequest: 10,
            maxGet: 60
        })
    }
}
