import { SqliteDB } from "../database/sqlite/sqlite.ts";
import type { UserlistsTable } from "../types/database.js";
import type { MangaInfo } from "../types/types.js";

const DB  = await SqliteDB.getInstance()
export class UserLists {
    private constructor(){}
    static cache: UserlistsTable[]
    static validateCache = false
    static createList(name: string, visibility: 'public' | 'private' = 'public'){
        this.validateCache = false
        return DB.insertOnUserLists(name, visibility)
    }
    static getAllUserList(){
        if(this.validateCache) return this.cache
        const lists = DB.getUserLists() as UserlistsTable[]
        this.cache = lists
        this.validateCache = true
        return lists
    }
    static getUserList(listID: number){
        return DB.getUserLists(listID) as UserlistsTable | undefined
    }
    static getUserListEntries(listId: number){
        return DB.getUserListEntries(listId)
    }
    static updateUserList(listId: number, name: string, visibility: 'public' | 'private' = 'public'){
        const res = DB.updateUserList({
            id: listId,
            create_at: '0-0-0 0:0:0',
            name,
            visibility,
        })
        if(res.changes > 0){
            this.validateCache = false
        }
    }
    static updateUserListEntrie(){
    }
    static deleteList(listId: number){
        if((DB.deleteUserList(listId)).changes > 0){
            this.validateCache = false
        }
    }
    static removeFromList(listId: number, mangaId: string){
        DB.deleteFromUserList(listId, mangaId)
    }
    static has(listId: number, mangaSrc: string){
        return DB.exists('userlistlink', `userlist_id=${listId} AND mangainfo_id='${mangaSrc}'`).has
    }
    static exists(listId: number){
        return DB.exists('userlists', `id=${listId}`).has
    }
    static addToList(listId: number, mangaInfo: MangaInfo ){
        if(!(DB.exists('mangainfo', `id = '${mangaInfo.src}'`)).has){
            DB.insertOnMangaInfo(mangaInfo)
        }
        if(!this.has(listId, mangaInfo.src)){
            DB.addToUserList(listId, mangaInfo.src, 'manga')
        }
    }
    async syncWithAnilist(){

    }
}
