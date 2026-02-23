import type { ChapterInfo } from "../types/types.js";
import fs from 'node:fs'
import os from 'os'
import fsp from 'node:fs/promises'
import path from "node:path";
import { DATA_DEFAULT_DIR } from "../const.js";

const historyPath = path.resolve(DATA_DEFAULT_DIR, 'read_history.json')

interface HistoryInterface extends ChapterInfo {
    time: number
}

const memory = new  Map<string, HistoryInterface>()

interface HistoryDataStruct {
	last_update: number,
	History: ChapterInfo[]
}

export class History{

    static fetch(): ChapterInfo[]{
    let val = Array.from(memory.values()).sort((a,b)=> b.time-a.time)
    return val;
    }

    static async load() {
        try{
            if(!fs.existsSync(historyPath)){
                await fsp.writeFile(historyPath, JSON.stringify({last_update: Date.now(),History: []}, null) )
                return true
            }
            const history = await fsp.readFile(historyPath)
            const obj = <HistoryDataStruct> JSON.parse(history.toString('utf-8'))
            if(!obj?.History) throw new Error('Corrupted file')
            obj.History.forEach(e=>{
                if(e && e.mangaTitle.length > 0){
                    memory.set(e.mangaTitle, {time: Date.now(),...e});
                }
            })
            return true;
        }catch(e){
            console.log(e)
            return false
        }
    }

    static save(mangaInfo: ChapterInfo){
    memory.set(mangaInfo.mangaTitle, {time: Date.now() ,...mangaInfo})
    this.store()
    }

    static async store() {
        try {

            if (memory.size < 1) return;

            const fileStruct: HistoryDataStruct = {
                last_update: Date.now(),
                History: Array.from(memory.values()).sort((a,b)=> b.time-a.time)
            }
            
            await fsp.writeFile(historyPath, JSON.stringify(fileStruct, null))

        } catch (e) {
            console.log(e)
        }
    }
}