import { DATA_DEFAULT_DIR } from "../const.js";
import fs from 'fs'
import fsp from 'fs/promises'
import path from "path";
import sanitize from "sanitize-filename";
import type {ServerName } from "../types/types.js";

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
interface TrackerStack<T extends Object> {
    stackIndex: number
    stackSize: number,
    stack: TrackerObject<T> []
}
export interface TrackerObject<T extends Object>{
    id: string
    startTime: number
    endTime: number
    enlapsedTime: number
    payload: T
}

class Stack<T>{
    protected stackIndex!: number
    protected stackSize!: number
    protected stack!: T []
    constructor(...stackInit:T[]){
        this.stack = new Array(...stackInit)
        this.stackIndex = Math.min(stackInit.length -1, 0)
        this.stackSize = stackInit.length
    }
    push(payload: T){
        this.stack.push(payload)
        this.stackIndex++
        this.stackSize++
    }
    pop(): T | undefined {
        if(this.stackSize > 0){
            this.stackIndex--
            this.stackSize--
            return this.stack.pop()
        }
        return undefined
    }
    get top(): T | undefined {
        return this.stack[this.stackIndex]
    }
    get stackLength() {
        return this.stackSize
    }
    get stackPointer(){
        return this.stackIndex
    }
    each(fn: (value: T, index: number)=>void){
        this.stack.forEach(fn)
    }
    getStack(){
        return this.stack
    }

}
export class TimeTracker<T extends Object>{ 
    static instance: TimeTracker<any> 
    private readonly createAt: number
    protected trackingMap!: Map<string, Stack<TrackerObject<T>>>
    protected date!: Date

    protected getId(){
        return `${this.date.getUTCDay()}-${this.date.getUTCMonth()}-${this.date.getUTCFullYear()}`
    }

    static getInstance<T extends Object>(){
        if(!this.instance){
            this.instance = new TimeTracker<T>()
        }
        return this.instance as TimeTracker<T>
    }
    
    private constructor(){
        this.trackingMap = new Map()
        this.date = new Date()
        this.createAt = Date.now()
    }
    track(table: string, id: string, payload: T){
        const map = this.trackingMap
        const trackerObject: TrackerObject<T> = {
            id,
            startTime: Date.now(),
            endTime: Infinity, 
            enlapsedTime: Infinity,
            payload: payload
        }
        if(!map.has(table)){
            map.set(table, new Stack( trackerObject ))
            return
        }
        const trackerTableStack = map.get(table)!
        if(trackerTableStack?.top?.id === id) return
        if(trackerTableStack.stackLength > 0){
            const top = trackerTableStack.top!
            if(top.endTime === Infinity || top.enlapsedTime === Infinity){
                top.endTime = Date.now()
                top.enlapsedTime = top.endTime - top.startTime
                trackerTableStack.pop()
                trackerTableStack.push(top)
            }
        }
        trackerTableStack.push(trackerObject)
    }
    stop(table:string){
        const stack = this.trackingMap.get(table)
        if(stack && stack.stackLength > 0){
            const top =  stack.top!
            if(top.endTime < Infinity || top.enlapsedTime < Infinity) return
            top.endTime = Date.now()
            top.enlapsedTime = top.endTime - top.startTime
            stack.pop()
            stack.push(top)
            return stack.getStack()
        }
    }
    each(tableName: string, fn: (value: TrackerObject<T>, index: number) => void){
        const stack = this.trackingMap.get(tableName)
        if(stack){
            stack.each(fn) 
        }
    }
    get(tableName: string){
        return this.trackingMap.get(tableName)?.top
    }
    drop(tableName: string){
        this.trackingMap.delete(tableName)
    }
    _overrideTop(tableName: string, data: TrackerObject<T>){
        const stack = this.trackingMap.get(tableName)
        if(stack && stack.stackLength > 0){
            stack.pop()
            stack.push(data)
        }
    }
}