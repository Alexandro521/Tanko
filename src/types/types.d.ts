import  type { Page } from "playwright"
import type { keyof } from "zod"
import type { AvalibleLangs } from "./lang.js"

export interface ChapterPage  {
    src: string
    page_index: string
}
type ChapterLangType = "es" | 'es-la' | 'pt-br' | 'en' | 'vi' | 'ru' | 'fr' 

export interface Chapter {
    id: string
    title: string
    translation_count: number
    translations: {
        [key in ChapterLangType] ?: ChapterLanguage
    }
}
export type ServerName = "mangadex" | "leercapitulo"

export interface ChapterLanguage {
    title: string
    lang: ChapterLangType,
    src: string
}

export interface SearchResult {
    value: string
    label: string
    link: string
    thumbnail?: string
}

export interface HistoryObject {
  mangaTitle: string,
  mangaSrc: string,
  chapterSrc: string,
  server: ServerName,
  last_title: string,
  last_index: number,
  last_lang: ChapterLangType,
  chapters_length: number,
  time: number,
}

export interface MangaInfo {
  title: string,
  src: string,
  description?:string,
  lastUploadChapterSrc?: string
}

export declare class MangaProvider{
    constructor(context: Page)
    public name:ServerName
    search(query: string ) : Promise<MangaInfo[]>
    getMangaInfo(mangaSrc: string): Promise<MangaInfo>
    getChapterList(mangaSrc:string): Promise<Chapter[]>
    getChapterPages(chapterSrc: string): Promise<ChapterPage[]>
    getPopulars(): Promise<MangaInfo[]>
    getLastMangas(): Promise<MangaInfo[]>
}

export interface ConfigurationInterface {
    isFirstRun: Boolean,
    langKey: AvalibleLangs,
    deepSearch: boolean,
    historyServerFilter: boolean,
    server: ServerConfInterface,
    imageCacheMaxSize: string,
    favoriteChapterLang: ChapterLangType | 'any',
    historyMaxSize: number,
    downloads_path : string,
}
export interface ServerConfInterface {
    name: ServerName,
    need_browser: boolean
}

/**Downloader */
export interface DownloadProps {
    mangaTitle: string,
    chapterTitle: string,
    serverName: ServerName,
    pages: ChapterPage[],
    format: DownloadFormat
}
export interface FormatProps {
    path: string,
    pages: ChapterPage[],
}
export interface  ImgBuffer {
    data: Buffer<ArrayBufferLike> | ArrayBuffer;
    info: sharp.OutputInfo;
}