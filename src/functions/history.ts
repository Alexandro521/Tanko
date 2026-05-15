import type { HistoryObject } from "../types/types.js";
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import { HISTORY_PATH } from "../const.js";

interface HistoryDataStruct {
  last_update: number,
  history: HistoryObject[]
}

export class History {
  private static map = new Map<string, HistoryObject>()

  static fetch(): HistoryObject[] {
    return Array.from(this.map.values())
      .sort((a, b) => b.time - a.time)
  }
  static async load() {
    try {
      if (!fs.existsSync(HISTORY_PATH)) {
        await fsp.writeFile(HISTORY_PATH, JSON.stringify({ last_update: Date.now(), History: [] }, null, '\t'))
        return true
      }
      const history = await fsp.readFile(HISTORY_PATH, {encoding: 'utf-8'})
      const obj = <HistoryDataStruct>JSON.parse(history.toString())
      if (!obj.history) {
        /*recovering corrupted file */
        await fsp.writeFile(HISTORY_PATH, JSON.stringify({ last_update: Date.now(), History: [] }, null, '\t'))
      }
      obj.history.forEach(e => {
        if (e && e.mangaTitle.length > 0) {
          this.map.set(e.mangaTitle, e);
        }
      })
      return true;
    } catch (e) {
      return false
    }
  }
  
  static save(mangaInfo: HistoryObject) {
    mangaInfo.time = Date.now()
    this.map.set(mangaInfo.mangaTitle, mangaInfo)
    this.store()
  }
  
  static async store() {
    try {
      if (this.map.size < 1) return;
      const fileStruct: HistoryDataStruct = {
        last_update: Date.now(),
        history: Array.from(this.map.values()).sort((a, b) => b.time - a.time)
      }
      await fsp.writeFile(HISTORY_PATH, JSON.stringify(fileStruct, null, '/t'))
    } catch (e) {
      console.log(e)
    }
  }
}
