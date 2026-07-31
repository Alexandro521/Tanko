import { TermImageGraphics } from "./graphics.protocol.ts";
import { Configuration } from "./configuration.ts";
import { Notify, NotifyType, type NotifyProps } from "./notify.ts";
import { TankoFetch } from "./fetch.ts";
import type { ChapterPage, LoadImageProps, TankoTermImgOutput, WSZ } from "../types/types.ts";

export class ImageCache extends Map {
    private MAX_CACHE_SIZE = 64 * 1024
    private byteLength = 0;
    private pointer = 0;
    private fifo!: string[];

    constructor() {
        super();
        Configuration.getInstance().then(conf => {
            this.MAX_CACHE_SIZE = conf.settings.cacheImageMaxByteLength;
            this.fifo = new Array(conf.settings.cacheImagePagesLength)
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
    push(key: string, value: TankoTermImgOutput) {
        if (
            this.pointer >= this.fifo.length ||
            this.byteLength + value.buffer.byteLength >= this.MAX_CACHE_SIZE
        ) this.pop()
        super.set(key, value);
        this.byteLength += value.buffer.byteLength;
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
        return this.has(page.src)
    }

    async loadImage(imgUrl: string, props: LoadImageProps) {
        if (this.has(imgUrl) && props?.forceReload === false) {
            const cache = <TankoTermImgOutput>this.get(imgUrl)
            let cacheWsz = cache.wsz
            let currentWsz = props.cotainerSize
            let index = 0
            let keyList = Object.keys(cacheWsz)
            let hasDiff = false;
            while (!hasDiff && index < keyList.length) {
                const keyName = keyList[index++] as keyof WSZ
                hasDiff = (cacheWsz[keyName]) !== (currentWsz[keyName])
            }
            if (props?.invalidateCache === true || hasDiff) {
                let remasterImg = TermImageGraphics.remaster(cache.buffer, props.position, cache.imgsz, props.cotainerSize);
                this.push(imgUrl, remasterImg)
                return
            }
            else {
                return
            }
        }

        let buffer: ArrayBuffer | undefined = undefined
        try {
            let isOk = false;
            let retrieves = 3
            let contentType: string | null = ''
            while (!isOk && retrieves > 0) {
                const res = await fetch(imgUrl)
                contentType = res.headers.get('Content-Type');
                if (!res.ok || contentType === null || !contentType?.startsWith('image')) {
                    retrieves--;
                    continue
                }
                buffer = await res.arrayBuffer();
                isOk = true
            }
            if (!isOk || !buffer) {
                const confInstance = await Configuration.getInstance()
                const { err_messages } = await confInstance.getLanguageInterface()
                if (contentType === null || contentType?.startsWith('image'))
                    throw new Error(`Invalid http header: Content-Type, \n expected: \"image/*\" ~ received: ${contentType}`)
                else
                    throw new Error(err_messages.page_loading.msg)
            }
            const imgObject = await TermImageGraphics.make({
                buffer: buffer,
                wsz: props.cotainerSize,
                position: props.position
            })
            this.push(imgUrl, imgObject)
        } catch (e) {
            if (e instanceof Error)
                Notify.pushError(e)
        }
    }
}