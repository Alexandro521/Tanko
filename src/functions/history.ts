import type { HistoryObject } from "../types/types.js";
import { HISTORY_PATH } from "../const.js";
import fsp from 'node:fs/promises'
import { Notify } from "./notify.js";
import { Configuration } from "./configuration.ts";

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
        Notify.pushError(e)
      }
      return false
    }
  }
  static save(mangaInfo: HistoryObject) {
    Configuration.getInstance()
      .then(conf => {
        if (this.map.size >= conf.settings.history_maxSize) {
          const sortByTime = this.map
            .values()
            .toArray()
            .sort((a, b) => a.time - b.time)
          //delete the 20% of the most old history entries
          const deletePorcentage = Math.floor((20 * this.map.size) / 100)
          for (let i = 0; i < deletePorcentage; i++) {
            const key = (sortByTime[i]).mangaTitle
            this.map.delete(key)
          }
          mangaInfo.time = Date.now()
          this.map.set(mangaInfo.mangaTitle, mangaInfo)
          this.store()
        } else {
          mangaInfo.time = Date.now()
          this.map.set(mangaInfo.mangaTitle, mangaInfo)
          this.store()
        }
    })
  }
  static async store() {
    try {
      if (this.map.size < 1) return;
      const fileStruct: HistoryDataStruct = {
        last_update: Date.now(),
        history: this.parseMap()
      }
      await fsp.writeFile(HISTORY_PATH, JSON.stringify(fileStruct, null, '\t'))
    } catch (e) {
      if (e instanceof Error) {
        Notify.pushError(e)
      }
    }
  }
}
