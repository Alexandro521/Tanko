import EventEmitter from "events"
import { UNITS } from "./types/enum.ts"
import { Notify } from "./functions/notify.ts"

export class CyclicArray<T> extends Array{
    protected pointer!: number
    protected maxLength!: number

    constructor(maxLength = Infinity){
        if(maxLength < 2) throw new Error('invalid length value')
        super(0)
        this.pointer = 0
        this.maxLength = maxLength
    }
    push(...values:T[]): number {
        for(let i = 0; i < values.length; i++){
            const avalibleSize = this.maxLength - this.length
            if(avalibleSize > 0){
                super.push(values[i])
            }else {
                const writeIndex = (this.pointer + i) % this.maxLength
                super[writeIndex] = values[i]
            }
        }
        this.pointer += values.length
        return super.length
    }
    popAt(index: number) {
        if (typeof index === 'number') {
            const absoluteIndex = Math.max(index, 0) % this.length
            if (absoluteIndex === this.length - 1) 
                return this.pop()
            const popElement = this[absoluteIndex]
            for (let i = absoluteIndex; i < this.length - 1; i++) {
                this[i] = this[i+1]
            }
            this.pop()
            return popElement
        }
    }
    /**@description get the relative position of the pointer, based on i mod n*/
    get index(): number {
        return this.pointer % this.maxLength
    }
    /**@description get the absolute value of the pointer*/
    get pointerValue(): number {
        return this.pointer
    }
    get max(): number {
        return this.maxLength
    }
}

type CachePolicy = 'LRU' | 'MRU' | 'FIFO' | 'LFU' | 'CYCLIC'
type CacheKey = number | string
type CacheEventMap<T> = {
    'add': [key: CacheKey, payload: T]
    'update': [key: CacheKey, oldPayload: T]
    'delete': [key: CacheKey]
    'full': []
    'freeAll': [total: number]
    'free': [total: number]
}
interface CacheLRUOptions extends CacheOptions{
    freePercent?: number
}
interface CacheMRUOptions extends CacheOptions{

}
interface CacheFIFOOptions extends CacheOptions{

}
interface CacheLFUOptions extends CacheOptions{

}
interface CacheCyclicOptions extends CacheOptions{

}

interface CacheOptions {
    maxSize?: number
    TTL?: number
}

abstract class Cache<T>{
    readonly policy!: CachePolicy
    protected gTTL!: number
    protected map!: Map<CacheKey, T>
    protected size!: number
    protected avalibleSize!: number
    readonly event!: EventEmitter<CacheEventMap<T>>

    constructor(options: CacheOptions, policy?: CachePolicy){
        const dPolicy = policy || 'LRU'
        this.policy = dPolicy;
        this.gTTL = options.TTL || -1
        this.avalibleSize = options.maxSize || 128;
        this.size = 0;
        this.map = new Map();
        this.event = new EventEmitter()
    }
    add(key: CacheKey, payload: T){
        if(this.map.has(key)){
            const oldPayload = this.map.get(key)!
            this.map.set(key, payload)
            this.event.emit('update', key, oldPayload)
            return true
        }
        if (this.avalibleSize > 0) {
            this.map.set(key, payload)
            this.event.emit('add', key, payload)
            this.size++
            this.avalibleSize--
            return true
        }else {
            this.event.emit('full')
        }
        return false
    }
    free(){
    }
    freeAll(){
        const keys = this.map.keys()
        const size = this.map.size
        keys.forEach((key) => {
            this.map.delete(key)
        })
        this.size = 0
        this.avalibleSize = 0
        this.event.emit('free', size)
    }
    delete(key: CacheKey){
        if (this.map.has(key)) {
            this.map.delete(key)
            this.size--
            this.avalibleSize++
            this.event.emit('delete', key)
            return true
        }
        return false
    }
    get(){
    }
    forEach(){
    }
}

class LRUCache<T> extends Cache<T>{
    keyVector!: number[]
    constructor(options: CacheLRUOptions){
        super(options)
    }
}

class MRUCache<T> extends Cache<T>{
    constructor(options: CacheMRUOptions){
        super(options)
    }
}

class FIFOCache<T> extends Cache<T>{
    constructor(options: CacheFIFOOptions){
        super(options)
    }
}

class LFUCache<T> extends Cache<T>{
    constructor(options: CacheLFUOptions){
        super(options)
    }
}

class CyclicCache<T> extends Cache<T>{
    constructor(options: CacheCyclicOptions){
        super(options)
    }
}

export function createCache<T>(options: CacheLRUOptions, policy: 'LRU'): LRUCache<T>
export function createCache<T>(options: CacheMRUOptions, policy: 'MRU'): MRUCache<T>
export function createCache<T>(options: CacheFIFOOptions, policy: 'FIFO'): FIFOCache<T>
export function createCache<T>(options: CacheLFUOptions, policy: 'LFU'): LFUCache<T>
export function createCache<T>(options: CacheCyclicOptions, policy: 'CYCLIC'): CyclicCache<T>
export function createCache<T>(options: CacheOptions, policy: CachePolicy): Cache<T>
{
    const cacheMap = {
        'LRU': LRUCache,
        'MRU': MRUCache,
        'FIFO': FIFOCache,
        'LFU': LFUCache,
        'CYCLIC': CyclicCache
    }
    const CacheClass = cacheMap[policy]
    if(!CacheClass) throw new Error(`Invalid cache policy: ${policy}`)
    return new CacheClass(options)
}

export class Alarm<T extends number | string>{
    private register!: CyclicArray<[key: T, timeStamp: number]>
    private nextTimestamp!: number
    private timer!: NodeJS.Timeout
    readonly event!: EventEmitter<{'ring': [key: T]}>

    constructor(init?: [key: T, timeStamp: number][]){
        this.register = new CyclicArray()
        this.nextTimestamp = 0
        this.timer = null as any
        this.event = new EventEmitter()
        this.set(init || [])
    }
    set(input: [key: T, timeStamp: number][]) {
        if (input.length) {
            const currenttime = Date.now()
            const filter = input.filter(e => e[1] > currenttime).sort((a, b) => a[1] - b[1])
            this.register.push(...filter)
            this.register.sort((a, b) => a[1] - b[1])
            if(!this.timer)
                this.next()
        }
    }
    remove(key:T){
        const index = this.register.findIndex(e=> e[0] === key)
        if(index > -1){
            const e = this.register.popAt(index)
            if(this.nextTimestamp == e){
                this.next()
            }
        }
    }
    stopAll(){
        if(this.timer){
            clearTimeout(this.timer)
            this.timer = null as any
        }
        this.nextTimestamp = 0;
        this.register = new CyclicArray()
    }
    private next(){
        if(this.timer){
            clearTimeout(this.timer)
            this.timer = null as any
        }
        if(this.register.length > 0){
            this.nextTimestamp = this.register[0][1]
            this.timer = setTimeout(()=> {
                while(this.register[0]?.[1] <= this.nextTimestamp){
                    const e = this.register.shift() as [T, number]
                    if (e) this.event.emit('ring', e[0])
                }
                this.next()
            },Math.abs(Date.now() - this.nextTimestamp))
        }
    }

}
type keyData = [rid: number, byteLenght: number]
type NetStorageEvent = {
    'deleted': [rid: number, reason: NET_MESSAGE_CODES],
    'push': []
}
export interface StorageOptions {
    /** @description the maximun size on byte of the storage, the minimun and default value is 64KB  */
    maxSize?: number,
    /** @description the maximun length of the storage, the minimun and default value is 8 */
    maxLength?: number,
    /** @description the time to live of the storage, the minimun and default value is 30 seconds */
    TTL?: number
}
export enum NET_MESSAGE_CODES {
    OVERSPACE = 1,
    REPLACE = 2,
    EXPIRED = 3,
    REJECT = 4,
    RESOLVE = 5,
    SENDDING = 6,
    DELETE = 7,
    ABORT =8
}
const NO_LIMIT = Infinity
export class Storage<T> {
    protected storage!:Map<number, T>
    protected usedSpace!: number
    protected keysRegister!: CyclicArray<keyData>
    protected temporal!: Alarm<number>

    readonly constrains = {
        maxByteLength: UNITS.KB * 4,
        maxLength: 2,
        ttl: UNITS.SECOND_MILISECONDS * 2
    }
    readonly event!: EventEmitter<NetStorageEvent>
    constructor({ maxSize, TTL, maxLength }: StorageOptions){
        if(typeof maxSize === 'number')
            this.constrains.maxByteLength = maxSize ? Math.max(maxSize, UNITS.KB * 4) : NO_LIMIT
        if(typeof maxLength === 'number')
            this.constrains.maxLength = maxLength ? Math.max(maxLength, 2) : NO_LIMIT
        if(typeof TTL === 'number')
            this.constrains.ttl = TTL ? Math.max(TTL, UNITS.SECOND_MILISECONDS * 2) : NO_LIMIT

        this.keysRegister = new CyclicArray(this.constrains.maxLength)
        this.storage = new Map()
        this.event = new EventEmitter()
        this.usedSpace = 0;
        this.temporal = new Alarm()
        this.temporal.event.on('ring', (rid) => {
            const index = this.keysRegister.findIndex(e=> e[0] === rid)
            if(index > -1) {
                this.keysRegister.popAt(index)
                this.storage.delete(rid)
                this.event.emit('deleted', rid, NET_MESSAGE_CODES.EXPIRED)
            }
        })
    }
    add(rid: number, data: T, dataByteLength: number, TTL?: number ): boolean{
        if(dataByteLength > this.constrains.maxByteLength && this.constrains.maxByteLength !== NO_LIMIT){
            return false
        }
        if(this.storage.size >= this.constrains.maxLength){
            const expiredKey = this.keysRegister.at(this.keysRegister.index)
            if(expiredKey){
                this.usedSpace -= expiredKey[1]
                this.temporal.remove(expiredKey[0])
                this.storage.delete(expiredKey[0])
                this.event.emit('deleted', expiredKey[0], NET_MESSAGE_CODES.REPLACE)
            }
        }
        if(this.constrains.maxByteLength !== NO_LIMIT){
            while( this.usedSpace + dataByteLength > this.constrains.maxByteLength ){
                const mostLongRegist = {
                    rid: 0,
                    register_index: 0,
                    byte_lenght: 0
                }
                for (let i = 0; i < this.keysRegister.length; i++) {
                    const reg_i = this.keysRegister[i]
                    if (reg_i && reg_i[1] > mostLongRegist.byte_lenght) {
                        mostLongRegist.rid = reg_i[0]
                        mostLongRegist.byte_lenght = reg_i[1]
                        mostLongRegist.register_index = i
                    }
                }
                this.usedSpace -= mostLongRegist.byte_lenght
                this.temporal.remove(mostLongRegist.rid)
                this.storage.delete(mostLongRegist.rid)
                this.keysRegister.popAt(mostLongRegist.register_index)
                this.event.emit('deleted', mostLongRegist.rid, NET_MESSAGE_CODES.OVERSPACE)
            }
        }
        this.keysRegister.push([rid, dataByteLength])
        this.storage.set(rid, data)
        this.usedSpace += dataByteLength
        const ttl = TTL ? Math.max(TTL, UNITS.SECOND_MILISECONDS * 2) : this.constrains.ttl
        if(ttl !== NO_LIMIT)
            this.temporal.set([[rid, (Date.now() + ttl)]])

        return true
    }
    get(rid:number) {
        return this.storage.get(rid)!
    }
    get byteLength (){
        return this.usedSpace
    }
    get size (){
        return this.storage.size
    }
    free(){
        this.temporal.stopAll()
        this.storage.clear()
        this.keysRegister = new CyclicArray(this.constrains.maxLength)
        this.usedSpace = 0
    }
    delete(rid: number){
        if(this.storage.delete(rid)){
            const index = this.keysRegister.findIndex((e)=> rid === e?.[0])
            if(index > -1){
                this.usedSpace -= this.keysRegister[index][1]
                this.keysRegister.popAt(index)
                this.temporal.remove(rid)
                this.event.emit('deleted', rid, NET_MESSAGE_CODES.DELETE)
            }
        }
    }
}