import { TimeTracker } from "../trackers/local.ts";
import { test, expect } from "bun:test";
import { randomInt, randomUUID } from "node:crypto";
import { SqliteDB } from "../database/sqlite/sqlite.ts";
import type { MangaInfo } from "../types/types.js";

const db = await SqliteDB.getInstance()
const time = TimeTracker.getInstance<{manga_id: string, pages_read: number}>()

const testMangaInfo:MangaInfo = {
    title: 'test_manga_info',
    src: randomUUID()
}

for(let i = 0; i < 10; i++){
    time.track('test', i.toString(), { manga_id: testMangaInfo.src, pages_read: randomInt(64)})
    await new Promise((resolve) => setTimeout(resolve, Math.max(300, randomInt(500))))
}
test('timeTracker', () => {
    expect(db.insertOnMangaInfo(testMangaInfo)).toHaveProperty('changes', 1)
    const stack = time.stop('test')
    expect(stack).toBeDefined()
    expect(stack!.length).toBe(10)
    const res = db.insertOnSessionTracker(stack!)
    expect(res.changes).toBe(10)
    expect(db.deleteFromMangaInfo(testMangaInfo.src).changes).toBeGreaterThan(0)
})

