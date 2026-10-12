import {test, expect, describe} from  'bun:test'
import {randomInt} from 'crypto'
import { SqliteDB } from '../database/sqlite/sqlite.ts';
import type { HistoryObject2, MangaInfo } from '../types/types.js';
import type { MangaInfoTable, UserlistsTable } from '../types/database.js';

const db = await SqliteDB.getInstance()

const mangaInfo = {
  title: 'manga test',
  src: crypto.randomUUID().split('-')[0],
  status:  'reading',
  anilistId: randomInt(100000, 999999),
  malId: randomInt(100000, 999999)
}

const historyRegist: HistoryObject2 = {
  chapter_index: randomInt(1, 999),
  chapter_src: crypto.randomUUID(),
  lang_iso: 'es',
  page_index: randomInt(1, 100),
  pages_read: randomInt(1, 100),
  read_progress: randomInt(1, 100),
  sort_order: 'asc',
  provider: 'mangadex',
  mangainfo: mangaInfo,
  chapter_title: 'chapter example input'
}
describe('Database Basic test', () => {
  test('insertOnMangaInfo', () => {
    const result = db.insertOnMangaInfo(mangaInfo)
    expect(result.changes).toBe(1)
    expect(db.exists('mangainfo', `id = '${mangaInfo.src}'`).has).toBe(1)
  })
  test('insertOnHistory', () => {
    const result = db.insertOnHistory(historyRegist)
    expect(result?.changes).toBe(1)
    expect(db.exists('read_history', `chapter_src = '${historyRegist.chapter_src}'`).has).toBe(1)
  })
  test('insertUserList', () => {
    const result = db.insertOnUserLists('test list', 'public')
    expect(result.id).toBeInteger()
    expect(db.exists('userlists', `name = 'test list'`).has).toBe(1)
  })
  test('addToUserList', ()=>{
    const userList = (db.getUserLists().find(list => list.name === 'test list'))!
    expect(userList).toBeDefined()
    const result = db.addToUserList(userList.id, mangaInfo.src, 'manga', 'test alias')
    expect(result.changes).toBe(1)
    expect(db.exists('userlistlink', `userlist_id = ${userList.id} AND mangainfo_id = '${mangaInfo.src}'`).has).toBe(1)
  })
  test('getUserListEntries', () => {
    const userList = (db.getUserLists().find(list => list.name === 'test list'))!
    expect(userList).toBeDefined()
    const entries = db.getUserListEntries(userList.id)
    expect(entries.length).toBeGreaterThan(0)
    const entry = entries.find(e => e.manga_id === mangaInfo.src)
    expect(entry).toBeDefined()
    expect(entry!.alias).toBe('test alias')
  })
  test('updateMangaInfo', () => {
    const updatedMangaInfo: MangaInfoTable = {
      id: mangaInfo.src,
      title: 'updated manga test',
      status: 'completed',
      anilist_id: mangaInfo.anilistId ?? 0,
      mal_id: mangaInfo.malId ?? 0,
      create_at: '2024-01-01'
    }
    const result = db.updateMangaInfo(updatedMangaInfo)
    expect(result.changes).toBe(1)
    const updatedRecord = db.getMangaInfo().find(m => m.id === mangaInfo.src)
    expect(updatedRecord?.title).toBe('updated manga test')
    expect(updatedRecord?.status).toBe('completed')
  })
  test('updateUserList', () => {
    const userList = (db.getUserLists().find(list => list.name === 'test list'))!
    expect(userList).toBeDefined()
    const updatedUserList: UserlistsTable = {
      id: userList.id,
      name: 'updated test list',
      visibility: 'private',
      create_at: userList.create_at
    }
    const result = db.updateUserList(updatedUserList)
    expect(result.changes).toBe(1)
    const updatedRecord = db.getUserLists().find(l => l.id === userList.id)
    expect(updatedRecord?.name).toBe('updated test list')
    expect(updatedRecord?.visibility).toBe('private')
  })
  test('deleteFromUserList after update', () => {
    const userList = (db.getUserLists().find(list => list.name === 'updated test list'))!
    expect(userList).toBeDefined()
    const result = db.deleteFromUserList(userList.id, mangaInfo.src)
    expect(result.changes).toBe(1)
    expect(db.exists('userlistlink', `userlist_id = ${userList.id} AND mangainfo_id = '${mangaInfo.src}'`).has).toBe(0)
  })
  test('deleteUserList after update', () => {
    const userList = (db.getUserLists().find(list => list.name === 'updated test list'))!
    expect(userList).toBeDefined()
    const result = db.deleteUserList(userList.id)
    expect(result.changes).toBe(1)
    expect(db.exists('userlists', `id = ${userList.id}`).has).toBe(0)
  })
  test('deleteFromHistory', () => {
    const result = db.deleteFromHistory(historyRegist.chapter_src)
    expect(result.changes).toBe(1)
    expect(db.exists('read_history', `chapter_src = '${historyRegist.chapter_src}'`).has).toBe(0)
  })
  test('deleteFromMangaInfo after update', () => {
    const result = db.deleteFromMangaInfo(mangaInfo.src)
    expect(result.changes).toBe(1)
    expect(db.exists('mangainfo', `id = '${mangaInfo.src}'`).has).toBe(0)
  })
})