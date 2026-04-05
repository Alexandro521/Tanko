import  type { Page } from "playwright"
import type { keyof } from "zod"

export interface ChapterPage  {
    src: string
    page_index: string
}
type ChapterLangKey = "es" | 'es-la' | 'pt-br' | 'en' | 'vi' | 'ru' | 'fr'
export interface Chapter {
    index: number | string,
    id: string
    title: string
    lang_n: number
    src: {
        'es'?: ChapterLangStruct,
        'en'?: ChapterLangStruct,
        'vi'?: ChapterLangStruct,
        'ru'?: ChapterLangStruct,
        'fr'?: ChapterLangStruct,
        'es-la'?: ChapterLangStruct,
        'pt-br'?: ChapterLangStruct,
    }
}


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
export interface ChapterInfo {
    mangaTitle: string,
    title: string,
    src: string
    nextChapter: string | null,
    prevChapter: string | null,
    pages: ChapterPage[],
    main_src:string,
}

export declare class MangaServerInterface{
    constructor(context: Page)
    search(query: string ) : Promise<SearchResult[] | undefined>
    getChaptersList(mangaSrc: string): Promise<{title: string, chapters: Chapter[]} | undefined>
    getChapterPages(chapterSrc: string): Promise<ChapterInfo | undefined>
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
    client : ConfigurationClient,
    language: 'es' | 'en',
    downloads_path : string,
    deepSearch: boolean,
}
export interface ConfigurationClient {
    name: 'leercapitulo' | 'mangadex',
    need_browser: boolean
}