import { TermImageGraphics } from "./graphics.protocol.ts";
import { Notify } from "./notify.ts";
import type { LoadImageProps, TankoTermImgOutput, WSZ } from "../types/types.ts";
import supportsTerminalGraphics from "supports-terminal-graphics";
import { Storage, type StorageOptions } from "../shared.ts";
import { randomInt } from "crypto";
import { UNITS } from "../types/enum.ts";

export interface ImageStorageOptions {
    maxByteLength: number,
    maxCacheLength: number
}

export class ImageStorage{
    private codedImageMap!: Map<string, number>
    private bufferImageMap!: Map<string, number>
    readonly storage!: Storage<TankoTermImgOutput | ArrayBuffer >
    constructor(options: StorageOptions) {
       this.storage = new Storage(options)
       this.codedImageMap = new Map()
       this.bufferImageMap = new Map()
    }
    add(url: string, data: TankoTermImgOutput | ArrayBuffer, ttl?: number){
        let size: number
        const key = randomInt(9000) + 1000
        if('byteLength' in data ){
            if(this.bufferImageMap.has(url)){
                const id = this.bufferImageMap.get(url)!
                this.storage.delete(id)
            }
            this.bufferImageMap.set(url, key)
            size =  data.byteLength
        } else {
            if (this.codedImageMap.has(url)) {
                const id = this.codedImageMap.get(url)!
                this.storage.delete(id)
            }
            this.codedImageMap.set(url, key)
            size = data.encodedImg.length
        }
        this.storage.add(key, data, size, ttl || UNITS.MINUTE_MILISECONDS * 10)
    }

    delete(url: string){
        const buffer = this.bufferImageMap.get(url)
        const coded = this.codedImageMap.get(url)
        if(coded){
            this.codedImageMap.delete(url)
            this.storage.delete(coded)
        }
        if(buffer){
            this.bufferImageMap.delete(url)
            this.storage.delete(buffer)
        }
    }
    getStats() {
        return {
            size: 0,
            length: this.codedImageMap.size,
        }
    }
    free(){
        this.bufferImageMap.clear()
        this.codedImageMap.clear()
        this.storage.free()
    }
    has(url: string) { 
        return {
            codec: this.codedImageMap.get(url),
            buffer: this.bufferImageMap.get(url)
        }
    }
    getImg(url: string){
        const id = this.codedImageMap.get(url)
        if(id){
            return this.storage.get(id) as TankoTermImgOutput
        }
    }
    getBuffer(url: string){
        const id = this.bufferImageMap.get(url)
        if(id){
            return this.storage.get(id) as ArrayBuffer
        }
    }
    async makeImage(imgUrl: string, props: LoadImageProps) {
        const has = this.has(imgUrl)
        if (has.codec && !props.forceReload) {
            const cache = <TankoTermImgOutput> this.storage.get(has.codec)!
            let keyList = Object.keys(cache.wsz)
            let index = 0
            let hasDiff = false;
            while (!hasDiff && index < keyList.length) {
                const keyName = keyList[index++] as keyof WSZ
                hasDiff = (cache.wsz[keyName]) !== (props.wsz[keyName])
            }
            if(!hasDiff) return
            //special case
            if(supportsTerminalGraphics.stdout.kitty){
                const imgScale = TermImageGraphics.scaleImg(cache.imgsz.img_originalWidth,cache.imgsz.img_originalHeight, props.wsz, props.imageFit || 'cover', props.maxImgWidth)
                const imgPosition = TermImageGraphics.calcPosition(props.position, imgScale, props.wsz)    
                const kittyEncodedImg =  TermImageGraphics.kitty(cache.encodedImg, {imgsz: imgScale, wsz: props.wsz, position: imgPosition})
                const output: TankoTermImgOutput = {
                    encodedImg: kittyEncodedImg,
                    imgsz: imgScale,
                    position: imgPosition,
                    wsz: props.wsz
                }
                this.add(imgUrl, output)
            }
            else if(has.buffer){
                const imgBuffer = this.storage.get(has.buffer) as ArrayBuffer
                const newImg = await TermImageGraphics.make(imgBuffer, props)
                this.add(imgUrl, newImg)
            }
        }
        try {
            if(has.buffer){
                const  buffer = <ArrayBuffer> this.storage.get(has.buffer)
                const imgObject = await TermImageGraphics.make(buffer, props)
                this.add(imgUrl, imgObject)
                return
            }
            throw new Error('invalid image buffer')
        } catch (e) {
            if (e instanceof Error)
                Notify.pushError(e)
        }
    }
}