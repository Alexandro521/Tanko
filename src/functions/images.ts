import sharp from "sharp";
import terminalImage from "terminal-image";
import { Configuration } from "./configuration.js";
import type { ChapterPage } from "../types/types.js";
import { Notify, NotifyType, type NotifyProps } from "./notify.js";

export class ImageCache extends Map {
    private MAX_CACHE_SIZE = 64 * 1024 //64 MB
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
    push(key: string, buffer: Buffer) {
        if (
            this.pointer >= this.fifo.length ||
            this.byteLength + buffer.byteLength >= this.MAX_CACHE_SIZE
        ) this.pop()
        super.set(key, buffer);
        this.byteLength += buffer.byteLength;
        this.fifo[this.pointer++] = key;
    }
    get stats() {
        return {
            size: this.byteLength,
            length: this.pointer,
        }
    }

}

export class ImageLoader extends ImageCache {
    constructor() {
        super()
    }
    private error(err: any) {
        const notify = Notify.getInstace()
        if (err instanceof Error) {
            const props: NotifyProps = {
                type: NotifyType.error,
                message: 'from Image Loader: ' + err.message,
                title: err.name,
            }
            notify.push(props)
        }
    }
    async loadImage(page: ChapterPage) {
        let buffer: Buffer | ArrayBuffer | undefined = undefined
        if (super.has(page.src))
            buffer = <Buffer>super.get(page.src)
        else {
            try {
                let isOk = false;
                let retrieves = 3
                while (!isOk && retrieves > 0) {
                    const res = await fetch(page.src)
                    const contentType = res.headers.get('Content-Type');
                    if (!res.ok) {
                        retrieves--;
                        continue
                    }
                    buffer = await res.arrayBuffer();
                    if (contentType === 'image/webp') {
                        buffer = await sharp (buffer).jpeg().toBuffer()
                    } else {
                        buffer = Buffer.from(buffer)
                    }
                    super.push(page.src, buffer);
                    isOk = true
                }
                if (!isOk || !buffer) {
                    const confInstance = await Configuration.getInstance()
                    const {err_messages} = await confInstance.getLanguageInterface()
                    throw new Error(err_messages.page_loading.msg)
                }

            } catch (e) {
                this.error(e)
            }
        }
        //const metadata = await sharp(buffer).metadata()

        const encodedString = await terminalImage.buffer(buffer as Uint8Array, {
            preserveAspectRatio: true,
            width: '100%',
            height: '100%',
            preferNativeRender: true
        })
        return encodedString
    }
}

