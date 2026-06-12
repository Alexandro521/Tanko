import type { HistoryObject } from "../types/types.js";
import { HISTORY_PATH } from "../const.js";
import fsp from 'node:fs/promises'

interface HistoryDataStruct {
  last_update: number,
  history: HistoryObject[]
}

export class History {
  private static map = new Map<string, HistoryObject>()
  static parseMap(): HistoryObject[] {
    return Array.from(this.map.values())
      .sort((a, b) => b.time - a.time)
  }
      
  static async load() {
    try {
      const historyRaw = await fsp.readFile(HISTORY_PATH, 'utf-8')
      const historyObject = <HistoryDataStruct>JSON.parse(historyRaw)
      historyObject.history.forEach(e => {
        if (e.mangaTitle.length > 0) {
          const date = new Date()
          date.setTime(e.time)
          this.map.set(e.mangaTitle, e);
        }
      })
      return true;
    } catch (e) {
      if (e instanceof Error) {
        console.log(e.message)
        await fsp.writeFile(HISTORY_PATH, JSON.stringify({ last_update: Date.now(), history: [] }, null))
      }
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
        history: this.parseMap()
      }
      await fsp.writeFile(HISTORY_PATH, JSON.stringify(fileStruct, null))
    } catch (e) {
      if (e instanceof Error) {
        console.error(e.message)
      }
    }
  }
}
