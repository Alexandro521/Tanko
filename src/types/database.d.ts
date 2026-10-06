
import type { ServerName, Translations } from "./types.ts"

export type DateString = `${number}-${number}-${number}`
export type TimeString = `${number}:${number}:${number}`
export type DateTimeString =`${DateString} ${TimeString}`
type JoinType = 'left' | 'full' | 'right'

/**Tables */
export interface MangaInfoTable {
    id:string,
    title: string,
    status: string,
    anilist_id: number,
    mal_id: number,
    create_at: DateString
}
export interface ReadHistoryTable {
    id?: number,
    page_index?: number,
    chapter_index?: number,
    sort_order?: 1 | 0,
    lang_iso?: Translations,
    read_progress?: number,
    read_time?: TimeString,
    read_date?: DateString,
    chapter_src?: string,
    manga_provider?: ServerName,
    chapter_title?: string,
    mangainfo_id?: string
}
export interface SessionTracker {
    id?: number,
    date?: DateString,
    start_time?: TimeString,
    end_time?: TimeString,
    enlapsed_time?: TimeString,
    pages_read_count?: number,
    mangainfo_id?: string
}
export interface UserListsLink {
    id?: number,
    userlist_id?: number,
    mangainfo_id?: string,
    alias?: string,
    reference_type?: 'chapter' | 'manga',
    added_at?: DateTimeString
}
export interface UserlistsTable {
    id: number,
    name: string,
    visibility: 'private' | 'public',
    create_at: DateTimeString
}

export interface ReadHistoryObject {
    chapter_index: number
    chapter_title: string
    chapter_src: string
    lang_iso: Translations
    manga_provider: ServerName
    pages_read: number
    page_index: number
    sort_order: 'asc' | 'desc'
    read_progress: number
    read_at: DateTimeString
    time_diff: DateTimeString
    manga_title: string
    manga_status: string
    manga_anilist_id: number | null
    manga_mal_id: number | null
    manga_src: string
}
export type ExtractFnType<Fn extends ()=>void> = Awaited<ReturnType<Fn>>
