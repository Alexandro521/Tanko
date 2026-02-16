import type { ChapterInfo } from "../types.js";
import fs from 'node:fs'
import os from 'os'
import fsp from 'node:fs/promises'
import path from "node:path";

const historyPath = path.resolve(os.homedir(),'yomu', 'data', 'read_history.json')

const memory = new  Map<string, ChapterInfo>()

interface HistoryDataStruct {
	last_update: number,
	History: ChapterInfo[]
}

export class History{

    static fetch(): ChapterInfo[]{
      let val = Array.from(memory.values())
      return val;
    }

    static async load() {
        try{
            if(!fs.existsSync(historyPath)){
                await fsp.writeFile(historyPath, JSON.stringify({last_update: Date.now(),History: []}, null, '\t') )
                return true
            }
            const history = await fsp.readFile(historyPath)
            const obj = <HistoryDataStruct> JSON.parse(history.toString('utf-8'))
            if(!obj?.History) throw new Error('Corrupted file')
            obj.History.forEach(e=>{
                if(e && e.mangaTitle.length > 0){
                    memory.set(e.mangaTitle, e);
                }
            })
            return true;
        }catch(e){
            console.log(e)
            return false
        }
    }

    static update(mangaInfo: ChapterInfo){
        memory.set(mangaInfo.mangaTitle, mangaInfo)
    }

    static save(mangaInfo: ChapterInfo){
       memory.set(mangaInfo.mangaTitle, mangaInfo)
       this.store()
    }

    static async store() {
        try {

            if (memory.size < 1) return;

            const fileStruct: HistoryDataStruct = {
                last_update: Date.now(),
                History: Array.from(memory.values())
            }
            
            await fsp.writeFile(historyPath, JSON.stringify(fileStruct, null, '\t'))

        } catch (e) {
            console.log(e)
        }
    }
}
