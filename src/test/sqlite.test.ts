import {test, expect, describe} from  'bun:test'
import { SqliteDB } from '../database/sqlite/sqlite.ts';
import type { HistoryInput, MangaInfo } from '../types/types.js';

const db = await SqliteDB.getInstance()

const mangaInfo: MangaInfo = {
        title: 'manga example input',
        src: crypto.randomUUID().split('-')[0]
}
const input: HistoryInput = {
  chapter_index: 30,
  chapter_src: crypto.randomUUID(),
  lang_iso: 'es',
  page_index: 13,
  pages_read: 14,
  read_progress: 54.7,
  sort_order: 'asc',
  provider: 'mangadex',
  mangainfo: mangaInfo,
  chapter_title: 'chapter example input'
}

test(`insert on history, mangainfo_id: ${mangaInfo.src}`, () => {
  expect(db.createHistory(input)).toHaveProperty('changes', 1)
})

test(`create user list 'test_list' and link mangainfo, id: ${mangaInfo.src}`, ()=>{
  const randomName = crypto.randomUUID()
  const res = db.createtUserList(randomName, 'private')
  expect(res).toHaveProperty('id')
  expect(res.id).toBeInteger()
  expect(db.addToUserList(res.id, mangaInfo.src, 'manga', 'testing manga')).toHaveProperty('changes', 1)
})

test(`delete from mangainfo, id: ${mangaInfo.src}`, () => {
  expect(db.deleteManga(mangaInfo.src)).toHaveProperty('changes', 1)
})
