import EventEmitter from "events"
import crypto from 'node:crypto'

export type ResponseChecker = (arg0: Response, reject: (reason: string) => void ) => void | Promise<void>

export type fetchUrl = string | URL | Request
export type RequestStatus = 'pendding' | 'resolve' | 'reject'

export interface RequestStruct {
    rid: number,
    url: string,
    retrieves: number,
    status: RequestStatus,
    abortCtl: AbortController,
    messageError: string,
}

export class RequestPool extends EventEmitter{ 
    private internalEvent!: EventEmitter
    private requestMap!: Map<string, RequestStruct>
    private responseMap!: Map<number, Response>
    private checkerRegister!: ResponseChecker[]

    constructor(){
        super()
        this.internalEvent = new EventEmitter()
        this.requestMap = new Map()
        this.responseMap = new Map()
        this.checkerRegister = []
    }
    private getUrlString(url: fetchUrl){
        if(url instanceof URL){
            return  url.toString()}
        else if (url instanceof Request){
            return url.url
        }else {
            return url
        }
    }
    setResponseChecker(checker: ResponseChecker){
        if(typeof checker === 'function')
            this.checkerRegister.push(checker)
    }
    has(url:fetchUrl){
        const rawUrl = this.getUrlString(url)
        return this.requestMap.has(rawUrl)
    }
    get(url:fetchUrl){
        const rawUrl = this.getUrlString(url)
        return this.requestMap.get(rawUrl)
    }
    push(url: fetchUrl, requestInit: RequestInit | undefined = undefined){
        const rid = crypto.randomInt(1048576)
        const rawUrl = this.getUrlString(url)

        if(this.requestMap.has(rawUrl)){
            const existsRequest = this.requestMap.get(rawUrl) as RequestStruct
            if(existsRequest.status === 'resolve' || existsRequest.status === 'reject'){
                existsRequest.retrieves +=1;
                this.requestMap.set(rawUrl, existsRequest)
                this.responseMap.delete(existsRequest.rid)
            }
            else  
                return;
        }
        const abortController = new AbortController()
        const requestData: RequestStruct = {
            rid: rid,
            url: rawUrl,
            status: 'pendding',
            abortCtl: abortController,
            retrieves: 0,
            messageError: ''
        }
        this.requestMap.set(rawUrl, requestData)
        fetch(url, {
            ...(requestInit ?? {}),
            signal: abortController.signal
        })
        .then(async (response)=>{
            let isValid = true
            let errReason = ''
            const reject = (reason: string)=>{
                errReason = reason 
                isValid = false
            }
            for(const middleware of this.checkerRegister){
                const resCopy = response.clone()
                const middleRes = middleware(resCopy, reject)
                if(middleRes instanceof Promise) 
                    await middleRes
                if(!isValid) break;
            }
            if(isValid){
                requestData.status = 'resolve'
                this.requestMap.set(rawUrl, requestData)
                this.responseMap.set(rid, response)
                this.internalEvent.emit('resolve', rid)
                this.emit('resolve', { url: rawUrl, rid })
            } else {
                requestData.status = 'reject'
                requestData.messageError = errReason
                this.requestMap.set(rawUrl, requestData)
                this.internalEvent.emit('reject', rid)
                this.emit('reject', { url: rawUrl, rid })
            }
        })
        .catch((error)=>{
            requestData.status = 'reject'
            if(error instanceof Error)
                requestData.messageError = error.message
            this.requestMap.set(rawUrl, requestData)
            this.internalEvent.emit('reject', rid)
            this.emit('reject', {url: rawUrl, rid})
        })
    }

    delete(url: fetchUrl){
        const urlRaw = this.getUrlString(url)
        
        if(!this.requestMap.has(urlRaw)) return
        const request = this.requestMap.get(urlRaw) as RequestStruct
        this.requestMap.delete(urlRaw)

        if(request.status === 'pendding'){
            request.abortCtl.abort()
        }
        else if( request?.status === 'resolve'){
            this.responseMap.delete(request.rid)
        }
    }
    free(){
        const requestArr = this.requestMap.values().toArray()
        for(const request of requestArr){
            if(request.status === 'pendding'){
                request.abortCtl.abort()
            }
            this.requestMap.delete(request.url)
            this.responseMap.delete(request.rid)
        }
    }
    async waitFor(url:fetchUrl){
        const rawUrl = this.getUrlString(url)
        const request = this.requestMap.get(rawUrl) as RequestStruct
        return new Promise<boolean>((resolve) =>{
            const requestResolveHandle = (rid: number)=>{
                if(request.rid !== rid) return
                this.internalEvent.removeListener('resolve', requestResolveHandle)
                this.internalEvent.removeListener('reject', requestRejectHandle)
                resolve(true)
            }
            const requestRejectHandle = (rid:number)=>{
                if(request?.rid === rid) {
                    this.internalEvent.removeListener('resolve', requestResolveHandle)
                    this.internalEvent.removeListener('reject', requestRejectHandle)
                    resolve(false)
                }
            }
            if (!request || request?.status === 'reject') resolve(false)
            else if (request?.status === 'resolve') resolve(true)
            else {
                this.internalEvent.on('resolve', requestResolveHandle)
                this.internalEvent.on('reject', requestRejectHandle)
            }
        })            
    }
    read(url: fetchUrl, destructiveRead: boolean = true): Response | undefined{
        const rawUrl = this.getUrlString(url)
        const request = this.requestMap.get(rawUrl)
        if(!request) return undefined
        if(request.status == 'reject') return undefined
        else if(request.status == 'pendding'){
            const error = new Error(`The request has not yet been completed.`, {
                cause: `trying to read a promise that has not yet been fulfilled\nUrl: ${rawUrl}\n Id: ${request.rid}`,
            })
            throw error
        }
        const response = this.responseMap.get(request.rid)
        if(destructiveRead || !response){
            this.delete(rawUrl)
        }else{
            this.responseMap.set(request.rid, response.clone())
        }
        return response
    }
}