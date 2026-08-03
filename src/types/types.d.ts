import  type { Page } from "playwright"
import type { keyof } from "zod"
import type { AvalibleLangs } from "./lang.js"
import type { Query } from "./anilist-schema.js"
import type { AltTitles } from "./mangadex/search.js"
import type { SharpInput } from "sharp"


export interface ChapterPage  {
    src: string
    page_index: string
}

type Translations = 
'ru' | 'fr' | 'ro' | 'hu' | 'th' | 'zh'|
'ko' | 'kk' | 'pt' | 'tr' | 'ja' | 'cb'|
"es" | 'es-la' | 'pt-br' | 'en' | 'vi' |
'bn'

export interface Chapter {
    chapter: number
    translation_count: number
    volume?:number
    translations: {
        [key in Translations] ?: ChapterLanguage
    }
}

export type ServerName = "mangadex" | "leercapitulo"

export interface ChapterLanguage {
    title: string
    lang: Translations,
    id: string
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
  last_lang: Translations,
  chapters_length: number,
  time: number,
}

export interface MangaInfo {
  title: string,
  src: string,
  description?:string,
  lastUploadChapterSrc?: string,
  anilistId?: string | number | null
  altTitles?: AltTitles[] | string[]
}
export type TrackerNames = "anilist"
export interface LoginData {
    Viewer: {
        id: number,
        name: string
    }
}
export interface TrackerProps {
    isAuth: boolean,
    instance: TrackerIntegration,
    data?: LoginData
}

export type TrackerInterface = {
    [key in TrackerNames]: TrackerProps
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
interface TrackProps { 
    mediaId: number, 
    status: MediaListStatus, 
    progress: number,
    lastRead: number,
    progressVolume?: number, 
    repeat?: number 
}

export declare class TrackerIntegration {
    public trackerName: TrackerNames
    static getInstance(): TrackerIntegration
    loginTui(): Promise<void>
    track(props: TrackProps): Promise<boolean>
    auth(): Promise<LoginData | undefined>
    logout():Promise<void>
    getId(mangaInfo: MangaInfo):Promise<number | undefined>
}

export interface ConfigurationInterface {
    isFirstRun: Boolean,
    langKey: AvalibleLangs,
    deepSearch: boolean,
    historyServerFilter: boolean,
    server: ServerConfInterface,
    cacheImageMaxByteLength: number,
    favoriteChapterLang: Translations | 'any',
    historyMaxSize: number,
    downloads_path : string,
    trackers: TrackerInterface,
    cacheImagePagesLength: number,
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
    pages: DownloadPageProps[],
}
export interface DownloadPageProps {
    index: number, data: ImgBuffer
}
export interface  ImgBuffer {
    data: Buffer<ArrayBufferLike>;
    info: sharp.OutputInfo;
}

//?Terminal Interfaces
//window size
export interface WSZ{
    w_height: number,
    w_width: number,
    w_colums: number,
    w_rows: number,
    w_cellPxWidth: number,
    w_cellPxHeight: number,
    w_ratio: number,
    w_position_x: number,
    w_position_y: number
}

export interface IMGSZ {
    img_originalWidth: number,
    img_originalHeight: number,
    img_pixelWidth: number,
    img_pixelHeigth: number,
    img_cellsHeigth: number,
    img_cellsWidth: number,
    img_ratio: number,
}

export interface StructImgPosition{
    x: 'center' | 'left' | 'right' 
    y: 'center' | 'top' | 'bottom',
    padding?:{
        top?: number
        bottom?: number
        left?: number
        right?: number
    }
}
export interface StructImgPositionProtocol{
    x: number,
    y: number
}
type TermImgProtocolName = 'kitty' | 'ascii'

export interface TermImgProtocolInput{
    position: StructImgPositionProtocol,
    imgsz: IMGSZ,
    wsz: WSZ,
}

export interface TankoTermImgInput{
    wsz: WSZ,
    position: StructImgPosition,
    forceAscii?: boolean
}

export type BitMapArray = ArrayBufferLike 
export type ImgBuffer = Buffer | Buffer<ArrayBufferLike >
export interface TankoTermImgOutput{
    position: StructImgPositionProtocol,
    encodedImg: string,
    base64?:string,
    imgsz: IMGSZ,
    wsz: WSZ
}
export interface LoadImageProps {
    cotainerSize: WSZ,
    position: StructImgPosition,
    invalidateCache?: boolean,
    forceReload?: boolean,
    forceAscii?: boolean
}
