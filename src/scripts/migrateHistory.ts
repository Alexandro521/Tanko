import type { HistoryObject, HistoryObject2 } from "../types/types.ts";
import { HISTORY_PATH } from "../const.ts";
import { mangaServerRegister } from '../servers/port.ts'
import { SqliteDB } from "../database/sqlite/sqlite.ts";
import fs from 'node:fs'

interface HistoryDataStruct {
    last_update: number,
    history: HistoryObject[]
}
const db = await SqliteDB.getInstance()
try {
    const avalibleProviders = mangaServerRegister.map(e=>e.name)
    const historyRaw = fs.readFileSync(HISTORY_PATH, 'utf-8')
    const historyObject = <HistoryDataStruct>JSON.parse(historyRaw)
    if ('history' in historyObject && 'length' in historyObject.history) {
        historyObject.history.forEach((e) => {
            const $: HistoryObject2 = {
                chapter_index: typeof e.last_index === 'number' ? Math.max(Number.MIN_SAFE_INTEGER, Math.min(e.last_index, Number.MAX_SAFE_INTEGER)) :  0,
                chapter_title: e.last_title,
                chapter_src: e.chapterSrc,
                lang_iso: e.last_lang || 'en',
                provider: e.server,
                mangainfo: {
                    title: e.mangaTitle,
                    src: e.mangaSrc
                },
                page_index: 0,
                pages_read: 0,
                read_progress: 0,
                sort_order: "desc",
            }
            if(
                typeof $.chapter_title === 'string' &&
                typeof $.chapter_src === 'string' &&
                avalibleProviders.includes($.provider) &&
                typeof $.mangainfo.src === 'string' &&
                typeof $.mangainfo.title === 'string'
            ) db.insertOnHistory($)
        })
    }
} catch (e) {
    console.log(e)
}
