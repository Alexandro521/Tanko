import  type { Page } from "playwright"

export interface ChapterPage  {
    src: string
    page_index: string
}
export interface Chapter {
    id: string
    title: string
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
     search(query: string ) : Promise<SearchResult[]>
     getChaptersList(mangaSrc: string): Promise<{title: string, chapters: Chapter[]} | undefined>
     getChapterPages(chapterSrc: string): Promise<ChapterInfo>
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
    server: string,
    language: string,
    downloads_path : string,
    deepSearch: boolean,
}

export  enum SignalsCodes {
    download_chapter = 46,
    read_chapter = 36,
    get_chapters_list = 26,
    resume_read = 37,
    exit = -1,
    main = 233,
    lasted_section = 343,
    history_section = 453,
    configuration_section = 563,
    search_section = 673,
    nex_chapter = 27,
    previous_chapter = 29,
    delete_from_history = 456,
    delete_history = 499,
    popular_section= 783,
    nullElement = -35454
}