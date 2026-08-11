import { TermImageGraphics } from "./graphics.protocol.ts";
import { Configuration } from "./configuration.ts";
import { Notify, NotifyType, type NotifyProps } from "./notify.ts";
import type { ChapterPage, LoadImageProps, TankoTermImgOutput, WSZ } from "../types/types.ts";
import type { SharpInput } from "sharp";
import supportsTerminalGraphics from "supports-terminal-graphics";

export class ImageCache extends Map {
    private MAX_CACHE_SIZE = 64 * 1024
    private byteLength = 0;
    private pointer = 0;
    private fifo!: string[];

    constructor() {
        super();
        Configuration.getInstance().then(conf => {
            this.MAX_CACHE_SIZE = conf.settings.image_maxCacheByteLength;
            this.fifo = new Array(conf.settings.image_maxCacheLength)
        })
            .catch(err => {
                const notify = Notify.getInstace()
                if (err instanceof Error) {
                    const props: NotifyProps = {
                        type: NotifyType.error,
                        message: 'from Image Cache: ' + err.message,
                        title: err.name,
                    }
                    notify.push(props)
                }
            })
    }
    pop() {
        const key = this.fifo[0];
        if (!super.has(key) || this.pointer <= 0) return;
        const buffer = <Buffer>super.get(key);
        this.byteLength = Math.max(0, this.byteLength - buffer.byteLength);
        this.pointer = Math.max(0, this.pointer - 1);
        super.delete(key)
        this.fifo.shift()
    }
    free() {
        super.keys().forEach((key) => {
            super.delete(key as string)
        })
        this.pointer = 0;
        this.byteLength = 0;
    }
    push(key: string, value: TankoTermImgOutput, size: number) {
        if (
            this.pointer >= this.fifo.length ||
            this.byteLength + size >= this.MAX_CACHE_SIZE
        ) this.pop()
        super.set(key, value);
        this.byteLength += size;
        this.fifo[this.pointer++] = key;
    }
    getStats() {
        return {
            size: this.byteLength,
            length: this.pointer,
        }
    }
}

export class ImageLoader extends ImageCache {
    AbortCtl!: AbortController
    constructor() {
        super()
        this.AbortCtl = new AbortController()
    }
    cacheHit(page: ChapterPage) {
        const key =  `${page.src}_request` 
        return this.has(page.src) || this.has(key)
    }
    async loadImage(imgUrl: string, props: LoadImageProps) {
        const settings = (await Configuration.getInstance()).settings
        if (this.has(imgUrl) && !props.forceReload) {
            const cache = <TankoTermImgOutput>this.get(imgUrl)
            let bakeWsz = cache.wsz
            let newWsz = props.cotainerSize
            
            let keyList = Object.keys(bakeWsz)
            let index = 0
            let hasDiff = false;
            
            while (!hasDiff && index < keyList.length) {
                const keyName = keyList[index++] as keyof WSZ
                hasDiff = (bakeWsz[keyName]) !== (newWsz[keyName])
            }
            if(!hasDiff) return
            else if(supportsTerminalGraphics.stdout.kitty){
                const imgScale = TermImageGraphics.scaleImg(cache.imgsz.img_originalWidth,cache.imgsz.img_originalHeight, props.cotainerSize, props.fit, props.maxWidth)
                const imgPosition = TermImageGraphics.calcPosition(props.position, imgScale, props.cotainerSize)    
                const kittyEncodedImg =  TermImageGraphics.kitty(cache.encodedImg, {imgsz: imgScale, wsz: props.cotainerSize, position: imgPosition})
                const output: TankoTermImgOutput = {
                    encodedImg: kittyEncodedImg,
                    imgsz: imgScale,
                    position: imgPosition,
                    wsz: props.cotainerSize
                }
                this.set(imgUrl, output)
            }
            else {
                const key = `${imgUrl}_request`
                const imgBuffer = this.get(key) as SharpInput
                const newImg = TermImageGraphics.make(imgBuffer, {
                        position: props.position,
                        wsz: props.cotainerSize,
                        forceAscii: settings.reader_forceAscii,
                        imageFit: props.fit,
                        forceProtocol: settings.reader_forceImgProtocol,
                        maxImgWidth: props.maxWidth
                    })
                this.set(imgUrl, newImg)
            }
        }
        try {
            const key = `${imgUrl}_request`
            const  buffer: ArrayBuffer | undefined = this.get(key)
            if(!buffer) throw new Error('invalid image buffer')
            const imgObject = await TermImageGraphics.make(buffer, {
                wsz: props.cotainerSize,
                position: props.position,
                forceAscii: settings.reader_forceAscii,
                imageFit: props.fit,
                forceProtocol: settings.reader_forceImgProtocol,
                maxImgWidth: props.maxWidth
            })

            this.set(key, buffer)
            this.push(imgUrl, imgObject, buffer.byteLength)
        } catch (e) {
            if (e instanceof Error)
                Notify.pushError(e)
        }
    }
}