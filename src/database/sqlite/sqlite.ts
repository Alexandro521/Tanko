import { SQLITE_DATABASE_PATH, RUNTIME_ENV } from '../../const.ts'
// import fsp from 'fs/promises'
// import path from 'path'
import EventEmitter from 'events'
import type { HistoryObject2, MangaInfo, ServerName, Translations, UserlistObject } from '../../types/types.ts'
import type { ReadHistoryObject, UserlistsTable, MangaInfoTable } from '../../types/database.ts'

type ExtractFnType<Fn extends ()=>void> = Awaited<ReturnType<Fn>>
type SupporRuntime = keyof typeof databaseMultiplexer
type DatabaseRuntime = ExtractFnType<typeof databaseMultiplexer[SupporRuntime]>
type BunDB = ExtractFnType<typeof databaseMultiplexer['Bun']>
type NodeDB = ExtractFnType<typeof databaseMultiplexer['Node']>
type strOperators = `${string} ${'='| 'LIKE' | 'NOT LIKE' } '${string}'`
type numberOperator = `${string} ${'=' | '>' | '<' | '<=' | '>=' | '!=' } ${string | number | `'${string}'`}`
type InOperator = `${string} ${'IN' | 'NOT IN'} (${string})`
type BetweenOperator = `${string} ${'NOT BETWEEN' | 'BETWEEN'} ${number} AND ${number}`
type WhereFilter = strOperators | numberOperator | InOperator | BetweenOperator
type StringDateTime = `${number}-${number}-${number} ${number}:${number}:${number}:`

const databaseMultiplexer = {
    "Node": async () => {
        const { DatabaseSync } = await import('node:sqlite')
        const database = new DatabaseSync(SQLITE_DATABASE_PATH, {
            enableDoubleQuotedStringLiterals: true
        })
        return database
    },
    "Bun": async () =>{
        const { Database }=  await import('bun:sqlite')
        const database = new Database(SQLITE_DATABASE_PATH)
        return  database
    },
} as const

type AsbtractBindEvents = {
    'load': [],
    'errload': [],
    'unsuported': []
}

export class AbstractBind extends EventEmitter<AsbtractBindEvents>{
    database!: DatabaseRuntime
    protected constructor() {
        super()
        const supportsRuntimes = Object.keys(databaseMultiplexer);
        if (!supportsRuntimes.includes(RUNTIME_ENV)) {
            this.emit('unsuported')
            return
        }
        databaseMultiplexer[RUNTIME_ENV as SupporRuntime]().then((db)=>{
            this.database = db
            this.emit('load')
        }).catch(() => {
            this.emit('errload')
        })
    }
    static async new(){
        return new Promise<AbstractBind>((resolve, reject) => {
            const instance = new AbstractBind()
            instance.on('load', ()=> resolve(instance))
            instance.on('errload', reject)
            instance.on('unsuported', reject)
        })
    }
    run(query: string){
        if(RUNTIME_ENV === 'Bun'){
            const db = this.database as BunDB
            db.run(query)
        }else if(RUNTIME_ENV === 'Node'){
            const db = this.database as NodeDB
            db.exec(query)
        }
    }
    prepare(query: string){
        return this.database.prepare(query)
    }
}

export class SqliteDB{
    private static instance: SqliteDB
    private database!: AbstractBind
    private constructor(databaselink: AbstractBind){
        this.database = databaselink
    }
    static async getInstance(){
        if(!this.instance){
            const database = await AbstractBind.new()
            this.instance = new SqliteDB(database)
        }
        return this.instance
    }
    getReadHistory() {
        const statement = this.database.prepare(`
            SELECT 
            chapter_index,
            chapter_title,
            chapter_src,
            lang_iso,
            manga_provider,
            pages_read,
            page_index,
            sort_order, 
            read_progress,
            read_time,
            read_date,
            other.title AS manga_title,
            other.status AS manga_status,
            other.anilist_id AS manga_anilist_id,
            other.mal_id AS manga_mal_id,
            other.id AS manga_src
            FROM read_history AS this
            LEFT JOIN mangainfo AS other
            ON this.mangainfo_id = other.id;
            `)
        return statement.all() as ReadHistoryObject[]
    }
    deleteFromHistory(chapterSrc: string){
        const statement = this.database.prepare(`DELETE FROM read_history WHERE chapter_src = $chapter_src`)
        return statement.run({$chapter_src: chapterSrc})
    }
    deleteAllHistory(){
        const statement = this.database.prepare(`DELETE FROM read_history`)
        return statement.run()
    }
    getMangaInfoById(mangaId: string){
        const statement = this.database.prepare(`
            SELECT id as manga_src, title, status, anilist_id, mal_id, create_at FROM mangainfo WHERE id = $manga_id
        `)
        return statement.get({$manga_id: mangaId}) as MangaInfoTable | undefined
    }
    getUserLists(){
        const statement = this.database.prepare(`SELECT id, name, visibility, create_at FROM userlists;`)
        return statement.all() as UserlistsTable[]
    }
    getMangaInfo() {
        const statement = this.database.prepare(`
            SELECT id, title, status, anilist_id, mal_id, create_at FROM mangainfo
        `)
        return statement.all() as MangaInfoTable[]
    }
    getUserListEntries(userListIdOrName: string | number){
        let constraint = typeof userListIdOrName === 'number' ? 
        `this.userlist_id = ${userListIdOrName}` :
        `userlists.name = "${userListIdOrName}"`

        const statement = this.database.prepare(`
            SELECT
            this.id as entry_id, 
            userlists.name as list_name,
            mangainfo.id as manga_id,
            title,
            status,
            anilist_id,
            mal_id,
            alias, 
            reference_type, 
            mangainfo.create_at,
            added_at 
            from userlistlink as this
            LEFT JOIN userlists on this.userlist_id = userlists.id
            LEFT JOIN mangainfo on this.mangainfo_id = mangainfo.id
            where ${constraint}
        `)
        return statement.all() as {
            entry_id: number, 
            title: string,
            list_name: string,
            manga_id: string,
            status: string
            anilist_id: number,
            mal_id: number,
            alias: string, 
            reference_type: string, 
            create_at: string,
            added_at: StringDateTime
        }[]
    }
    // getTimeTracks(){
    // }
    insertOnHistory(input: HistoryObject2){
        const statement = this.database.prepare(`
            INSERT INTO read_history 
            (chapter_index, chapter_src, lang_iso, page_index, pages_read, read_progress, sort_order,chapter_title, manga_provider, mangainfo_id)
            VALUES 
            ($chapter_index, $chapter_src, $lang_iso, $page_index, $pages_read, $read_progress, $sort_order,$chapter_title, $provider, $mangainfo_id)`)
        const results = statement.run({
            $chapter_index: input.chapter_index,
            $chapter_src: input.chapter_src,
            $lang_iso: input.lang_iso,
            $page_index: input.page_index,
            $pages_read: input.pages_read,
            $read_progress: input.read_progress,
            $sort_order: input.sort_order,
            $mangainfo_id: input.mangainfo.src,
            $chapter_title: input.chapter_title,
            $provider: input.provider
        })
        return results
    }
    insertOnMangaInfo(mangaInfo: { src: string; status: string; title: string; anilistId?: number }){
        const statement = this.database.prepare(`
            INSERT INTO mangainfo (id, title, status, anilist_id, mal_id)
            VALUES ($manga_id, $title, $status, $anilist_id, $mal_id)
        `)
        return statement.run({
            $manga_id: mangaInfo.src,
            $title: mangaInfo.title,
            $status: mangaInfo.status,
            $anilist_id: mangaInfo.anilistId ?? null,
            $mal_id: null,
        })
    }
    deleteFromMangaInfo(mangaInfoId: string){
        const statement = this.database.prepare(`DELETE FROM mangainfo WHERE id = $manga_info_id`)
        return statement.run({$manga_info_id: mangaInfoId})
    }
    insertOnUserLists(name:string, visibility: 'public' | 'private'){
        const exists = this.exists('userlists', `name = '${name}'`)
        const getIdStatement = this.database.prepare(`SELECT id FROM userlists WHERE name = $userlist_name`)
        if(exists.has){
            return getIdStatement.get({$userlist_name: name}) as {id: number}
        }
        const statement = this.database.prepare(`
            INSERT INTO userlists (name, visibility) VALUES ($name, $visibility)
        `)
        statement.run({$name: name, $visibility: visibility})
        return getIdStatement.get({$userlist_name: name}) as {id: number}
    }
    // createTimeTrack(){

    // }
    updateUserList(data: UserlistsTable){
        const statement = this.database.prepare(`
        UPDATE userlists SET name = $name, visibility = $visibility WHERE id = $id    
        `)
        return statement.run({
            $name: data.name,
            $visibility: data.visibility,
            $id: data.id
        })
    }
    updateMangaInfo(mangainfoId: MangaInfoTable){
        const statement = this.database.prepare(`
            UPDATE mangainfo SET title = $title, status = $status, anilist_id = $anilist_id, mal_id = $mal_id WHERE id = $manga_info_id
        `)
        return statement.run({
            $title: mangainfoId.title,
            $status: mangainfoId.status ?? 'reading',
            $anilist_id: mangainfoId.anilist_id ?? null,
            $mal_id: mangainfoId.mal_id ?? null,
            $manga_info_id: mangainfoId.id
        })
    }
    addToUserList(userListId: number, mangaInfoId: string, type: 'manga' | 'chapter' = 'manga', alias: string | null = null){
        const statement = this.database.prepare(`
            INSERT into userlistlink (userlist_id, mangainfo_id, alias, reference_type)
            VALUES ($userlist_id, $mangainfo_id, $alias, $reference_type)
        `)
        return statement.run({
            $userlist_id: userListId,
            $mangainfo_id: mangaInfoId,
            $alias: alias, 
            $reference_type: type
        })
    }
    deleteFromUserList(userListId: number, mangaInfoId: string){
        const statement = this.database.prepare(`
            DELETE FROM userlistlink WHERE userlist_id = $userlist_id AND mangainfo_id = $mangainfo_id
        `)
        return statement.run({
            $userlist_id: userListId,
            $mangainfo_id: mangaInfoId
        })
    }
    deleteUserList(userListId: number){
        const statement = this.database.prepare(`
            DELETE FROM userlists WHERE id = $userlist_id
        `)
        return statement.run({
            $userlist_id: userListId
        })
    }
    exists(table: string, where: WhereFilter){
        const existStatement = this.database.prepare(`SELECT EXISTS (SELECT 1 FROM ${table} WHERE ${where}) AS has`)
        return existStatement.get() as {has: 1 | 0}
    }
    _dropDatabase(){

    }
    _closeConnection(){

    }
    _execQuery(){

    }
}

