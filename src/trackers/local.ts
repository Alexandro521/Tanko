import { DATA_DEFAULT_DIR } from "../const.js";
import fs from 'fs'
import fsp from 'fs/promises'
import path from "path";
import sanitize from "sanitize-filename";
import type { ChapterLanguage, ServerName } from "../types/types.js";
import { extractChapterNumber } from "../utils.ts";
export interface LocalTrackerProps {
    mangaId: string | number,
    chapterCount: number,
    chapterIndex: number,
}

export  class LocalTracker {
    private workdir = path.join(DATA_DEFAULT_DIR, '.tracker')
    private static instance: LocalTracker
    public static getInstance() {
        if (!this.instance) {
            this.instance = new LocalTracker()
        }
        return this.instance
    }
    private constructor() {
        if (!fs.existsSync(this.workdir)) {
            const res = fs.mkdirSync(this.workdir, { recursive: true })
            if (!res) {
                throw new Error('The ".tracker" directory failed to be created.')
            }
        }
    }
    async exists(props: LocalTrackerProps){
        if(!fs.existsSync(this.getFilePath(props.mangaId))){
            return false
        }
        return true
    }
    getFilePath(Id: string | number) {
        const filename = sanitize(typeof Id === 'number' ? String(Id) : Id, { replacement: '_' })
        const outputPath = path.join(this.workdir, `manga_${filename}.dat`)
        return outputPath
    }
    async regist(props: LocalTrackerProps) {
        const bufferSize =  Math.max((props.chapterCount >> 3), 3) + 4
        const  alloc = Buffer.alloc(bufferSize+8, 0, "binary")
        const buffer = new Uint16Array(alloc)
        buffer[0] = props.chapterCount
        buffer[1] = props.chapterIndex

        await fsp.writeFile(this.getFilePath(props.mangaId), buffer, {
            encoding: 'binary',
        })
    }
    async markAsRead(props: LocalTrackerProps) {
        if(await this.hasReading(props)) return false
        const buff16 = new Uint16Array(2)
        const buff32 = new Uint32Array(1)
        const wrPosition = ((props.chapterIndex >> 5) << 2) +4 //+4 Skip the first two bytes
        const file = await fsp.open(this.getFilePath(props.mangaId), 'r+')
        //obtain the reading count
        await file.read(buff16, 0, 2, 2)

        await file.read(buff32, 0, 4, wrPosition)
        buff16[0] += 1
        buff32[0] |= 0x1 << ((props.chapterIndex & 31))
        await file.write(buff16, 0, 2, 2)
        await file.write(buff32, 0, 4, wrPosition)
        await file.close()
        return true
    }
    async update(props: LocalTrackerProps) {
        const file = await fsp.open(this.getFilePath(props.mangaId), 'r+')
        const stats = await file.stat()
        const buffer = new Uint16Array(1)
        await file.read(buffer, 0, 2, 0)
        if((stats.size - (props.chapterCount >> 3)) <= 2){
            await file.appendFile(new Uint8Array(8).fill(0))
        }
        if(props.chapterCount > buffer[0]){
            buffer[0] = props.chapterCount
            await file.write(buffer,0,2,0)
        }
        await file.close()
    }
    async hasReading(props: LocalTrackerProps) {
        const file = await fsp.open(this.getFilePath(props.mangaId))
        const buffer = new Uint8Array(1)

        await file.read(buffer, 0, 1, (props.chapterIndex >> 3)+4)
        const isRead = ((buffer[0] >> (props.chapterIndex & 7)) & 1) === 1
        await file.close()
        return isRead
    }
    async getStats(props: LocalTrackerProps, fileTarget: string | undefined = undefined) {
        const file = await fsp.open(fileTarget ?? this.getFilePath(props.mangaId))
        const stats = await file.stat()
        const buffer = new Uint16Array(stats.size>>2)
        await file.read(buffer)
        const readingMap = new Map<number, any>()
        let totalRead = buffer[1], bitIndex = 0
        for(let chunkIndex = 2; chunkIndex < buffer.length && totalRead > 0 && bitIndex < buffer[0]; chunkIndex++){
            const chunk = buffer[chunkIndex]
            for(let i = 0; i < 16; i++, bitIndex++){
                if(((chunk >> i)&0x0001) === 0x0001){
                    --totalRead;
                    readingMap.set(bitIndex, chunkIndex)
                }
            }
        }
        await file.close()
        return {
            chapterCount: buffer[0],
            reading: buffer[1],
            readingMap: readingMap
        }
    }
}
interface TimeReadObject {
    mid: string,
    cid: string,
    providerName: ServerName,
    chapterNumber: number,
    chapterTitle: string
    readTime: number,
    startTime: number,
}
interface TimeTrackerStruct {
    totalReadTime: number,
    date: string,
    reads: Map<string, TimeReadObject>
}

export class TimeTracker{
    static trackerMap = new Map<string, TimeTrackerStruct>()
    private mid!: string
    private provider!: ServerName
    private key!: string
    private date!: string
    private ArrayReadObjects!: TimeReadObject[]
    private currentObjectRegister!: TimeReadObject | undefined

    constructor(mid: string, provider: ServerName) {
        this.mid = mid,
        this.provider = provider
        this.ArrayReadObjects = new Array()
        const date = (new Date()).toDateString()
        const key =  date
        const has = TimeTracker.trackerMap.has(key)
        this.key = key
        this.date = date
        const mangaTimeStruct: TimeTrackerStruct = has ? <TimeTrackerStruct> TimeTracker.trackerMap.get(mid) : {
            totalReadTime: 0,
            date,
            reads: new Map()
        }
        if (!has) {
            TimeTracker.trackerMap.set(mid, mangaTimeStruct)
        }
    }
    static store() {
        this.trackerMap.forEach((value, key) => {
            const filename = sanitize(key)
            const pathUrl = path.join(process.cwd(), filename)
            const object = {
                totalReadTime: value.totalReadTime,
                date: value.date,
                reads: value.reads.values()
            }
            fs.writeFile(pathUrl, JSON.stringify(object, null, '\t'), () => console.log('Error on write'))
        })
    }
    initTrack(chapterInfo: ChapterLanguage) {
        const readObject: TimeReadObject = {
            chapterNumber: extractChapterNumber(chapterInfo.title) || -1,
            chapterTitle: chapterInfo.title,
            cid: chapterInfo.id,
            mid: this.mid,
            providerName: this.provider,
            readTime: Infinity,
            startTime: Date.now(),
        }

        if (this.currentObjectRegister === undefined) {
            this.currentObjectRegister = readObject
            return
        }
        if (this.currentObjectRegister.cid === chapterInfo.id) {
            if (this.currentObjectRegister.readTime === Infinity) {
                this.currentObjectRegister =  readObject
            }
            return
        }

        const index = this.ArrayReadObjects.findIndex( e => e.cid === chapterInfo.id )
        if (index) {
            const existsObject = this.ArrayReadObjects[index]
            if (
                this.currentObjectRegister.readTime > existsObject.readTime
                && this.currentObjectRegister.readTime !== Infinity
            ) {
                this.ArrayReadObjects[index] = this.currentObjectRegister
            }
        } else {
            this.ArrayReadObjects.push(this.currentObjectRegister)
            this.currentObjectRegister = undefined
        }
        this.currentObjectRegister = readObject
    }
    endTrack() {
        if (this.currentObjectRegister === undefined) return
        const readTime = Math.abs(Date.now() - this.currentObjectRegister.startTime)
        this.currentObjectRegister.readTime = readTime
        this.ArrayReadObjects.push(this.currentObjectRegister)
        this.currentObjectRegister = undefined
    }

    regist() {
        const registObject = TimeTracker.trackerMap.get(this.key)
        if (registObject) {
            this.ArrayReadObjects.forEach((e) => {
                const exists = registObject.reads.get(e.cid)
                if (exists) {
                    exists.readTime += e.readTime
                } else {
                    registObject.reads.set(e.cid, e)
                }
                registObject.totalReadTime += e.readTime
            })
            TimeTracker.trackerMap.set(this.key, registObject)
        }
    }
}
