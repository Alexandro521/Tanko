import { SQLITE_DATABASE_PATH, RUNTIME_ENV } from '../../const.ts'
// import fsp from 'fs/promises'
// import path from 'path'
import EventEmitter from 'events'
import type { HistoryInput, MangaInfo } from '../../types/types.js'

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

class AbstractBind extends EventEmitter<AsbtractBindEvents>{
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
    getHistory(){
        
    }
    getUserLists(){

    }
    getMangas(){

    }
    getList(){

    }
    getTimeTracks(){

    }
    createHistory(input: HistoryInput){
        const mangaInfoExists = this.exists('mangainfo',` id = '${input.mangainfo.src}'`)
        if(!mangaInfoExists.has){
            this.createManga(input.mangainfo)
        }
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
    createManga(mangaInfo: MangaInfo){
        const statement = this.database.prepare(`
            INSERT INTO mangainfo (id, title, status, anilist_id, mal_id)
            VALUES ($manga_id, $title, $status, $anilist_id, $mal_id)
        `)
        return statement.run({
            $manga_id: mangaInfo.src,
            $title: mangaInfo.title,
            $status: 'reading',
            $anilist_id: mangaInfo.anilistId ?? null,
            $mal_id: null,
        })
    }
    deleteManga(mangaInfoId: string){
        const statement = this.database.prepare(`
            DELETE FROM mangainfo WHERE id = $manga_info_id    
        `)
        return statement.run({$manga_info_id: mangaInfoId})
    }
    createtUserList(name:string, visibility: 'public' | 'private'){
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
    createTimeTrack(){

    }
    updateUserList(){

    }
    updateManga(){

    }
    addToUserList(userListId: number, mangaInfoId: string, type: 'manga' | 'chapter' = 'manga', alias: string | null = null){

        const statement = this.database.prepare(`
            INSERT into userlistlink (userlist_id, mangainfo_id, alias, reference_type)
            VALUES ($userlist_id, $mangainfo_id, $alias, $reference_type)
        `)
        return statement.run({$userlist_id: userListId, $mangainfo_id: mangaInfoId,$alias: alias, $reference_type: type})
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

