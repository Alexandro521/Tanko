import  type { Page } from "playwright"
import type { keyof } from "zod"
import type { AvalibleLangs } from "./lang.js"

export interface ChapterPage  {
    src: string
    page_index: string
}
type ChapterLangKey = "es" | 'es-la' | 'pt-br' | 'en' | 'vi' | 'ru' | 'fr' 

export interface Chapter {
    id: string
    title: string
    lang_n: number
    src: {
        [key in ChapterLangKey] ?: ChapterLangStruct
    }
}

export type ServerName = "mangadex" | "leercapitulo"

export interface ChapterLangStruct {
    title: string
    lang: ChapterLangKey,
    src: string
}

export interface SearchResult {
    value: string
    label: string
    link: string
    thumbnail: string
}

export interface HistoryObject {
  mangaTitle: string,
  mangaSrc: string,
  server: ServerName,
  last_title: string,
  last_index: number,
  last_lang: ChapterLangKey,
  chapters_length: number,
  time: number,
}

export interface MangaInfo {
  title: string,
  src: string,
  description?:string,
  chapters: Chapter[]
}

export declare class MangaServerInterface{
    constructor(context: Page)
    public name:ServerName
    search(query: string ) : Promise<SearchResult[] | undefined>
    getMangaInfo(mangaSrc: string): Promise<MangaInfo | undefined>
    getChapterPages(chapterSrc: string): Promise<ChapterPage[] | undefined>
    getPopulars(): Promise<PopularManga[] | undefined>
    getLastMangas(): Promise<LastedManga[] | undefined>
}

export interface ChapterMinInfo {
    title:string,
    src:string
}

export interface PopularManga {
    title: string,
    src : string,
    last_chapter: ChapterMinInfo
}
export interface LastedManga {
    title: string,
    src: string,
    last_chapters: ChapterMinInfo[]
}

export interface ConfigurationInterface {
    langKey: AvalibleLangs,
    deepSearch: boolean,
    historyServerFilter: boolean,
    server: ServerConfInterface,
    imageCacheMaxSize: string,
    favoriteChapterLang: ChapterLangKey | 'any',
    historyMaxSize: number,
    downloads_path : string,
}
export interface ServerConfInterface {
    name: ServerName,
    need_browser: boolean
}
