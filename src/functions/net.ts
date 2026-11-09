import EventEmitter from "events"
import {randomInt} from 'node:crypto'
import { UNITS } from "../types/enum.ts"
import { CyclicArray, Alarm, type StorageOptions } from "../shared.ts"
import { Storage } from "../shared.ts"

export type middleWare = (arg0: Response, reject: (reason: string) => void ) => void | Promise<void>
type FetchUrl = string | URL | Request

export interface RequestInfo {
    rid: number,
    url: string,
    retrieves: number,
    requestInit: RequestInit,
    abortCtl: AbortController,
    status: RequestStatus,
    error?: Error;
    method: string
}
export enum RequestStatus  {
    pendding = 1,
    resolve = 2,
    waiting = 3,
    reject = 6,
    aborted = 7,
}
export enum NetState {
    IDLE = 1,
    WORKING = 2,
    PAUSED = 3
}
export enum NET_MESSAGE_CODES {
    OVERSPACE = 1,
    REPLACE = 2,
    EXPIRED = 3,
    REJECT = 4,
    RESOLVE = 5,
    SENDDING = 6,
    DELETE = 7
}
type NetEvent = {
    'resolve': [rid: number],
    'reject': [rid: number, message?: string],
    'abort': [rid: number],
    'sending': [rid: number],
}
type NetInternalEvent = {
    'push_queu': [],
    'push_queu_atemporal': [],
    'request_resolve': [rid: number],
    'request_reject': [rid: number, message: string]
}
/**
 * @type Middleware
 * @description
 * the handler for reject a incoming request gives two argumens:
 * @param {boolean} retry - 
 * if the value is true and the internal request retrieves counter is less that three the request to be resend and evaluate again,
 * if the retrieves counter y equal or greatter that three this request well be reject and the event reject is raise,
 * if the value is false the reject is reject inmediatly and a event is fairing
 * @param {string} reason - A optional string for describe the reason of the request rejection
 */
export type MiddleWareRejectHandler = (retry: boolean,reason?: string) => void
export type MiddleWare = (arg0: Headers, reject: MiddleWareRejectHandler) => void | Promise<void>
export interface NetStorageOptions {
    /** @description the maximun size on byte of the storage, the minimun and default value is 64KB  */
    maxSize?: number,
    /** @description the maximun length of the storage, the minimun and default value is 8 */
    maxLength?: number,
    /** @description the time to live of the storage, the minimun and default value is 30 seconds */
    TTL?: number
}
export interface NetOptions{
    requestMaxRetries?: number;
    
    storage?: NetStorageOptions
}

function getUrlString(input: FetchUrl) {
    if (input instanceof URL) {
        return input.toString()
    } else if (input instanceof Request) {
        return input.url
    } else return input
}

export class NetRegister {
    protected requestMap!: Map<number, RequestInfo>
    protected urlMap!: Map<string, number>
    constructor(){
        this.requestMap = new Map()
        this.urlMap = new Map()
    }
    add(url: string, requestInit: RequestInit, status?: RequestStatus){
        const rid = randomInt(9000) + 1000;
        this.urlMap.set(url.toString(), rid)
        const abortCtl = new AbortController()
        Object.defineProperties<RequestInit>(requestInit, {
            'signal': {
                value: abortCtl.signal
            }
        })
        Object.freeze(requestInit)
        const req: RequestInfo = {
            rid,
            url: url,
            retrieves: 0,
            requestInit: requestInit,
            abortCtl: abortCtl,
            status:  status  || RequestStatus.pendding,
            method: requestInit.method || 'GET'
        }

        this.requestMap.set(rid, req)
        return req
    }
    set(rid: number, data: RequestInfo){
        this.requestMap.set(rid, data)
    }
    setStatus(rid: number, status: 'resolve' | 'reject' | 'pendding' | 'aborted' | 'waiting'= 'pendding'){
        const request = this.requestMap.get(rid)
        if(request){
            switch(status){
                case "resolve":
                    request.status = RequestStatus.resolve
                    break
                case "reject":
                    request.status = RequestStatus.reject
                    break
                case "pendding":
                    request.status = RequestStatus.pendding
                    break
                case "aborted":
                    request.status = RequestStatus.aborted
                    break
            }
            this.requestMap.set(rid, request)
        }
    }
    getStatus(rid: number): RequestStatus | undefined {
        const req = this.requestMap.get(rid)
        if(req){
            return req.status
        }
    }
    get(rid:number){
        return this.requestMap.get(rid)
    }
    has(rid: number){
        return this.requestMap.has(rid)
    }
    delete(rid: number){
        this.requestMap.delete(rid)
    }
    free(){
        for(const rid of this.requestMap.keys()){
            const req = this.requestMap.get(rid)!
            try{
                req.abortCtl.abort()
            }catch(e){

            }
            }
            this.requestMap.clear()
            this.urlMap.clear()
    }
    getRid(url: string){
        return this.urlMap.get(url)
    }
    get size(){
        return this.requestMap.size
    }
}
export class NetStorage  extends Storage< Response >{ 
    constructor(options: StorageOptions){
        super(options)
    }

    getHeader(rid:number){
        const res = this.storage.get(rid)
        if(res)
            return res.headers
    }
    _consume(_rid: number){

    }
}
export class Net{ 
    protected register!: NetRegister
    protected storage!: NetStorage
    protected middleWareRegister!: MiddleWare[]
    protected middleWareMap!:Map<string, number>
    protected requestQueue!: CyclicArray<number>
    protected temporal!: Alarm<number>
    public event!: EventEmitter<NetEvent>
    private internalEvent!: EventEmitter<NetInternalEvent>
    private state: NetState = NetState.IDLE
    private maxRetries = 3
    constructor(options?: NetOptions){
        this.temporal = new Alarm()
        this.register = new NetRegister()
        this.middleWareMap = new Map()
        this.middleWareRegister = new Array<MiddleWare>()
        this.storage = new NetStorage(options?.storage || {})
        this.requestQueue = new CyclicArray()
        this.event = new EventEmitter()
        this.internalEvent = new EventEmitter()
        this.maxRetries = options?.requestMaxRetries || 3
        this.internalEvent.on('push_queu', () => {
            if(this.state === NetState.IDLE){
                this.state = NetState.WORKING
                this._processQueue()
            }
        })
        this.internalEvent.on('request_reject', (rid, message)=> {
            if(!message.startsWith('AbortError')){
                this.requestRetrieve(rid)
            }else {
                this.register.delete(rid)
                this.event.emit('abort', rid)
            }
        })
        this.internalEvent.on('request_resolve', (rid)=>{
            const resHeader = this.storage.getHeader(rid)!
            let _retry = false
            try{
                for(const middle of this.middleWareRegister){
                    middle(resHeader, (retry: boolean, reason) => {
                        _retry = retry
                        throw new Error(reason)
                    })
                }
                this.register.setStatus(rid, 'resolve')
                this.event.emit('resolve', rid)
            }catch(e){
                if(_retry){
                    this.requestRetrieve(rid)
                }else {
                    this.register.setStatus(rid, 'reject')
                    let msg = ''
                    if(e instanceof Error){
                        msg = e.message
                    }
                    this.event.emit('reject', rid, msg)
                }
            }
        })
        this.storage.event.on('deleted', (rid)=>{
            this.register.delete(rid)
        })
        this.temporal.event.on('ring', (rid)=>{
            if(this.register.has(rid)){
                this.requestQueue.push(rid)
                if(this.state === NetState.IDLE) this.internalEvent.emit('push_queu')
            }
        })
    }
    private async _processQueue(){
        while(this.requestQueue.length > 0 && this.state !== NetState.PAUSED){
            const readyQueu = []
            for(let i =0; i < 8 && this.requestQueue.length > 0; i++){
                readyQueu.push(this.requestQueue.shift()!)
            }
            await this._processRequest(readyQueu)
        }
        this.state = NetState.IDLE
    }

    stopQueue(){
        this.state = NetState.PAUSED
    }

    resumeQueue(){
        if(this.requestQueue.length){
            this.state = NetState.WORKING
            this._processQueue()
        }else{
            this.state = NetState.IDLE
        }
    }
    private requestRetrieve(rid: number) {
        const data = this.register.get(rid)!
        if (data.retrieves < this.maxRetries) {
            data.retrieves += 1
            this.register.set(rid, data)
            this.requestQueue.push(rid)
            if (this.state === NetState.IDLE) this.internalEvent.emit('push_queu')
        } else {
            this.event.emit('reject', rid, 'maximum number of retries achieved')
            this.register.delete(rid)
        }
    }
    private async _processRequest(ridArray: number[]){
        await Promise.all(
            ridArray.map(rid => {
                const requestData = this.register.get(rid)!
                const requestInit:RequestInit = requestData.requestInit
                return new Promise( resolve =>{
                    this.event.emit('sending', rid)
                    fetch(requestData.url, requestInit)
                    .then(async (res)=>{
                        let contentLenght = parseInt(res.headers.get('Content-Length') || '0')
                        if (contentLenght === 0) {
                            contentLenght = (await res.clone().bytes()).byteLength
                        }
                        this.storage.add(rid, res, contentLenght)
                        this.internalEvent.emit('request_resolve', rid)
                        resolve(rid)
                    })
                    .catch((err)=>{
                        let msg = ''
                        if(err instanceof Error) msg = err.name + ': ' + err.message
                        this.internalEvent.emit('request_reject', rid, msg)
                        resolve(rid)
                    })
                })
            })
        )
    }
    appendMiddleWare(middleWare: MiddleWare){
        if('name' in middleWare){
            this.middleWareMap.set(middleWare.name, this.middleWareRegister.length)
        }
        this.middleWareRegister.push(middleWare)
    }
    detachMiddleWare(middleWare: MiddleWare){
        if('name' in middleWare && this.middleWareMap.has(middleWare.name)){
            const index = this.middleWareMap.get(middleWare.name)!
            for(let i = index; i < this.middleWareRegister.length -1; i++){
                this.middleWareRegister[i] = this.middleWareRegister[i + 1]
            }
            this.middleWareRegister.pop()
            this.middleWareMap.delete(middleWare.name)
        }
    }
    detachAllMiddleWare(){
        this.middleWareRegister = new Array<MiddleWare>()
        this.middleWareMap.clear()
    }
    pushRequest(input: FetchUrl , init?: RequestInit){
        const urlStr = getUrlString(input)
        const requestInit: RequestInit = init ? init : {}
        const requestInfo = this.register.add(urlStr, requestInit)
        this.requestQueue.push(requestInfo.rid)
        if (this.state === NetState.IDLE)
            this.internalEvent.emit('push_queu')
        return requestInfo.rid

    }
    scheduleRequest(input: FetchUrl, timeStamp: number , init?: RequestInit){
        const timeNow = Date.now()
        if(timeStamp > timeNow){
            const urlString = getUrlString(input)
            const requestInit: RequestInit = init ? init : {}
            const reqestInfo = this.register.add(urlString, requestInit, RequestStatus.waiting)
            this.temporal.set([[reqestInfo.rid, timeStamp]])
            return reqestInfo.rid
        }
    }
    async waitFor(rid: number):Promise<boolean> {
        return new Promise((resolve) => {
            const status = this.register.getStatus(rid)
            if (!status) {
                resolve(false)
            }
            switch (status) {
                case RequestStatus.resolve:
                    resolve(true)
                    break
                case RequestStatus.reject:
                    resolve(false)
                    break
                case RequestStatus.aborted: 
                    resolve(false)
                    break
                case RequestStatus.waiting: 
                    resolve(false)
                    break
                case RequestStatus.pendding: {
                    const resolveHandler = (resolveRid: number)=>{
                        if(resolveRid === rid){
                            clearListeners()
                            resolve(true)
                        }
                    }
                    const rejectHandler = (rejectRid: number)=>{
                        if(rejectRid === rid){
                            clearListeners()
                            resolve(false)
                        }
                    }
                    const clearListeners = ()=>{
                        this.event.removeListener('abort', rejectHandler)
                        this.event.removeListener('reject', rejectHandler)
                        this.event.removeListener('resolve', resolveHandler)
                    }
                    this.event.on('resolve', resolveHandler)
                    this.event.on('reject', rejectHandler)
                    this.event.on('abort', rejectHandler)
                    break
                }
            }
        })
    }
    get(rid: number){
        return this.register.get(rid)
    }
    getByUrl(url: FetchUrl){
        const urlStr = getUrlString(url)
        const rid =  this.register.getRid(urlStr)
        if(rid){
            return this.register.get(rid)
        }
    }
    getRid(url: FetchUrl){
        const urlStr = getUrlString(url)
        return this.register.getRid(urlStr)
    }
    getStatus(rid: number){
        return this.register.getStatus(rid)
    }
    has(url: FetchUrl){
        const urlStr = getUrlString(url)
        const rid = this.register.getRid(urlStr)
        return rid !== undefined
    }
    free(){
        this.register.free()
        this.storage.free()
        this.requestQueue = new CyclicArray()
        this.temporal.stopAll()
    }
    read(rid: number, destroy?: boolean) {
        const requestInfo = this.register.get(rid)
        if(!requestInfo){
            throw new Error(`RID ${rid} has expired or no longer exists`)
        }
        switch(requestInfo.status){
            case RequestStatus.pendding: 
                throw new Error('The request is pending, please wait for it!')
            case RequestStatus.reject:
                throw new Error('The request has been rejected')
            case RequestStatus.aborted:
                throw new Error('The request has been aborted')
            case RequestStatus.waiting:
                throw new Error('The request is not yet ready to be sent')
            case RequestStatus.resolve: {
                const response = this.storage.get(rid)!
                if(destroy){
                    this.register.delete(rid)
                    this.storage.delete(rid)
                    return response
                }else {
                    return response.clone()
                }
            }
        }
    }
    abort(rid: number, reason?: string) {
        const req = this.register.get(rid)
        if (req) {

            if (req.status === RequestStatus.pendding) {
                this.register.setStatus(rid, 'aborted')
                const index = this.requestQueue.findIndex((e) => e === rid)
                if (index < 0) {
                    req.abortCtl.abort(reason)
                } else this.requestQueue.popAt(index)
            } else if (req.status === RequestStatus.waiting) {
                this.temporal.remove(rid)
                this.register.delete(rid)
            }
        }
    }
    delete(rid: number){
        const info = this.register.get(rid)
        if(info){
            if(info.status === RequestStatus.pendding){
                this.abort(rid)
            }else if(info.status === RequestStatus.waiting){
                this.temporal.remove(rid)
                this.register.delete(rid)
            }
            else {
                this.register.delete(rid)
                this.storage.delete(rid)
            }
        }
    }
}