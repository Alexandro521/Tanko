import terminalImage from "terminal-image";
import type { ChapterPage } from "../types.js";
import sharp from "sharp";


export class ImageCache {
    static MAX_SIZE = 64000000 //64 MB in KB
    static priorityList = new Array<string>(24); // 24 pages history on cache 
    static cacheSize = 0;
    static pointer = 0;
    static cache = new Map<string, Buffer>()

    private static pop() {
        if (ImageCache.pointer === 0) return;
        let key = ImageCache.priorityList[0];
        if (!ImageCache.cache.has(key)) return;
        const data = <Buffer>ImageCache.cache.get(key)
        ImageCache.cacheSize = Math.max(0, ImageCache.cacheSize - data.byteLength);
        ImageCache.cache.delete(key)

        if (ImageCache.pointer > 0) ImageCache.pointer -= 1;
        //move elements
        for (let i = 1; i < ImageCache.priorityList.length; i++) {
            ImageCache.priorityList[i - 1] = ImageCache.priorityList[i];
        }
    }

    static add(key: string, data: Buffer) {
        if (ImageCache.pointer > ImageCache.priorityList.length || (ImageCache.cacheSize + data.byteLength) >= ImageCache.MAX_SIZE) ImageCache.pop()
        ImageCache.cache.set(key, data);
        ImageCache.cacheSize += data.byteLength;
        ImageCache.priorityList[ImageCache.pointer] = key;
        ImageCache.pointer++;
    }

    static has(key: string) {
        return ImageCache.cache.has(key);
    }
    static get(key: string) {
        return ImageCache.cache.get(key)
    }
}


export async function loadImage(srcs: ChapterPage) {
    try {
        // spin.start('cargando...')
        let res: Buffer = Buffer.from('');

        if (ImageCache.has(srcs.src)) {
            res = <Buffer>ImageCache.get(srcs.src)

        } else {
            let isOk = false;
            let retrieves = 3

            while (!isOk && retrieves > 0) {
                let response = await fetch(srcs.src)

                if (!response.ok) {
                    retrieves--;
                    continue
                }
                if (response.headers.get('Content-Type') === 'image/webp') {
                    res = await sharp((await response.arrayBuffer())).jpeg().toBuffer()
                } else {
                    res = Buffer.from(await response.arrayBuffer())
                }

                ImageCache.add(srcs.src, res);
                isOk = true

            }
            if (!isOk) {
                throw new Error('fallo al descargar la imagen, reintentado 3 veces')

            }
        }
        const image = await terminalImage.buffer(res)
        process.stdout.write(image)

        //  spin.stop()
    } catch (e) {
        console.log('error: ', e)
    }
}

