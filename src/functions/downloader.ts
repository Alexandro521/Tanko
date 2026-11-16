import fs from 'fs'
import fsp from 'fs/promises'
import path from 'path';
import {Buffer} from 'node:buffer'
import sanitize from 'sanitize-filename';
import { DOWNLOADS_DEFAULT_DIR } from '../const.js';
import { isAcceptedContentTypeImage, makeDir } from '../utils.js';
import { EventEmitter } from 'events';
import { DownloadFormat, UNITS } from '../types/enum.js';
import type { ChapterPage, DownloadProps, FormatProps, ImgBuffer } from '../types/types.js';
import { Net, RequestStatus } from './net.ts';
import { Notify } from './notify.ts';
import sharp from 'sharp';
import { Alarm } from '../shared.ts';

const PDFOptions: PDFKit.PDFDocumentOptions = {
    margin: '0',
    compress: true,
    autoFirstPage: false,
    subset: 'PDF/A-1a',
    tagged: true,
    pdfVersion: '1.4',
    info: {
        Author: 'tanko cli',
        Keywords: 'manga, manga reader, cli, tanko',
    }
}

type DownloaderEvents = {
    'received': [rid: number, pageIndex: number, byteLength: number]
    'processing': [pageIndex: number]
    'processing-done': [pageIndex: number]
    'processing-fail': [pageIndex: number]
    'fetch-error': [pageIndex: number]
    'done': [format: string, path: string, time: number]
    'error': [message: string],
    'internal_ready_for_read': []
}
export class Downloader  {
    private net!: Net
    private static instance: Downloader;
    private pageIndexMap: Map<number, number>
    private alarm!: Alarm<any>
    readonly event: EventEmitter<DownloaderEvents>
    public lastFetchId!: string | undefined;

    private constructor() {
        this.event = new EventEmitter()
        this.pageIndexMap = new Map()
        this.alarm = new Alarm()
        this.net = new Net({
            requestMaxRetries: 8,
            queuRequestLength: 4,
            storage: {
                maxLength: 80,
                maxSize: UNITS.MB * 512,
                TTL: 0
            }
        })
        this.net.appendMiddleWare((headers, rej)=>{
            const contentType = headers.get('Content-Type') || ''
            if(!isAcceptedContentTypeImage(contentType)){
                rej(true, 'Invalid content type')
            }
        })
    }

    private pushImageRequests(images: ChapterPage[], headers?: Headers){
        this.net.stopQueue()
        for(const img  of images){
            const rid = this.net.pushRequest(img.src, {headers})
            this.pageIndexMap.set(rid, parseInt(img.page_index))
        }
    }
    private async pdf(props: FormatProps, fromCache: boolean) {
        const pdfKit = (await import('pdfkit')).default
        const document = new pdfKit(PDFOptions)
        document.pipe(fs.createWriteStream(`${props.path}.pdf`))
        await this.requestHandler('linear', props, fromCache, async (rid, pageIndex) =>{
            const res = this.net.read(rid, false)
            let buffer = await res.arrayBuffer()
            const metadata = await sharp(buffer).metadata()
            const { height, width,  } = metadata;
            this.event.emit('received', rid, pageIndex, buffer.byteLength)
            const page = document.addPage({
                size: [width, height],
                margin: '0%', 
                info: {
                    Author: 'Tanko',
                    Creator: 'Tanko CLI',
                    CreationDate: new Date(),
                }
            })
            if( metadata.format !== 'png' && metadata.format !== 'jpeg'){
               const pngBuffer = await sharp(buffer)
               .png({effort: 9, compressionLevel: 7, quality: 90})
               .toBuffer()
                page.image(pngBuffer, { align: 'center', cover: [width, height] })
            }else {
                page.image(buffer, { align: 'center', cover: [width, height] })
            }
        })

        document.end();
    }
    private async images(props: FormatProps, fromCache: boolean) {
        await this.requestHandler('random' ,props, fromCache, async (rid, pageIndex)=>{
            const response = this.net.read(rid, false)
            const imgBuffer = await response.arrayBuffer()
            const metadata = await sharp(imgBuffer).metadata()
            const filePath = path.join(props.path, `page${pageIndex + 1}.${metadata.format}`)
            await fsp.writeFile(filePath, new DataView(imgBuffer))
        })
    }
    private async requestHandler(order: 'random' | 'linear' ,props: FormatProps, fromCache: boolean, pageHandler: (rid: number, pageIndex: number) => void | Promise<void>) {
        return new Promise(async (resolve) => {
            const alarmId = 128
            this.alarm.set([[alarmId, Date.now() + UNITS.MINUTE_MILISECONDS * 5]])
            const readyQueu = new Array<number>()
            let isWorking = false
            let counter = props.pages.length

            const pageProcessor = async (rid: number, pageIndex: number) => {
                try {
                    this.event.emit('processing', pageIndex)
                    const page =  pageHandler(rid, pageIndex)
                    if(page instanceof Promise) await page
                    this.event.emit('processing-done', pageIndex)
                } catch (e) {
                    counter--;
                    this.event.emit('processing-fail', pageIndex)
                    if (e instanceof Error) {
                        this.event.emit('error', e.message)
                    }
                }
            }
            const QueuProcessor = async () => {
                isWorking = true
                let rid: undefined | number = 0
                while ((rid = readyQueu.shift()) !== undefined) {
                    const index = this.pageIndexMap.get(rid)!
                    await pageProcessor(rid, index)
                    counter--;
                }
                isWorking = false
                if (counter < 1 ) {
                    clear()
                    resolve(true)
                }
            }
            const clear = ()=>{
                    this.alarm.stopAll()
                    this.alarm.event.removeListener('ring', alarmListener)
                    this.event.removeAllListeners('internal_ready_for_read')
                    this.net.event.removeListener('resolve', resolveListener)
                    this.net.event.removeListener('reject', rejectListener)

            }
            const resolveListener = (rid: number, byteLength: number) => {
                readyQueu.push(rid)
                const pageIndex = this.pageIndexMap.get(rid)!
                this.event.emit('received', rid, pageIndex, byteLength)
                this.event.emit('internal_ready_for_read')
            }
            const rejectListener = (rid: number, message?: string)=>{
                counter--;
                const pageIndex = this.pageIndexMap.get(rid)!
                this.event.emit('fetch-error', pageIndex)
                this.event.emit('error', message || '')
            }
            const alarmListener = (key: number)=>{
                if(key === alarmId){
                    clear()
                    this.event.emit('error', 'timeout')
                    resolve(true)
                }
            }
            this.event.on('internal_ready_for_read', async () => {
                if (!isWorking) {
                    await QueuProcessor()
                }
            })
            if (fromCache) {
                if(order === 'linear'){
                    props.pages.sort((a, b)=> a.index - b.index)
                }
                for (const page of props.pages) {
                    const requestInfo = this.net.getByUrl(page.url)
                    if (requestInfo && requestInfo.status === RequestStatus.resolve) {
                        readyQueu.push(requestInfo.rid)
                    }
                }
                this.event.emit('internal_ready_for_read')
            } else {
                if(order === 'linear'){
                    this.net.resumeQueue()
                    const sorted = props.pages.sort((a, b)=> a.index - b.index)
                    for(const page of sorted){
                        const rid = this.net.getRid(page.url)
                        if(rid && await this.net.waitFor(rid)){
                            readyQueu.push(rid)
                        }else {
                            counter--;
                            this.event.emit('fetch-error', page.index)
                        }
                    }
                    this.event.emit('internal_ready_for_read')
                }else {
                    this.alarm.event.on('ring', alarmListener)
                    this.net.event.on('resolve', resolveListener)
                    this.net.event.on('reject', rejectListener)
                    this.net.resumeQueue()
                }
            }
        })
    }

    private async cbz(props: FormatProps, fromCache: boolean) {
        await this.zip(props, fromCache, 'cbz')
    }
    private async zip(props: FormatProps, fromCache: boolean, format = 'zip') {
        const { ZipArchive } = await import("archiver" ) 
        const writeStream = fs.createWriteStream(`${props.path}.${format}`)
        const archive = new ZipArchive({
            zlib: { level: 4 },
        })
        archive.on('error', (err) => {
            writeStream.close()
            throw err
        })
        writeStream.on('close', () => {
            writeStream.close()
        })
        archive.pipe(writeStream)
        await this.requestHandler('random', props, fromCache, async (rid, pageIndex) => {
            const res = this.net.read(rid, false)
            const buffer = await res.arrayBuffer()
            const metadata = await sharp(buffer).metadata()
            archive.append( Buffer.from(buffer),{ 
                name: `page${pageIndex + 1}.${metadata.format}` 
            })
        })
        archive.finalize()
    }
    static getInstance() {
        if (!this.instance) {
            this.instance = new Downloader();
        }
        return this.instance
    }
    async free() {
        this.net.free()
        this.pageIndexMap.clear()
    }
    async download(props: DownloadProps, fromCache: boolean, headers?: Headers, basePath?:string) {
        const downloadDir = await makeDir(
            basePath || DOWNLOADS_DEFAULT_DIR,
            props.format,
            props.serverName,
            props.mangaTitle,
            props.format === DownloadFormat.img ? 
            sanitize(props.chapterTitle) : ''
        ) 
        if(!fromCache)
            this.pushImageRequests(props.pages, headers)
        
        // if (!this.imageCaching || props.chapterTitle !== this.lastFetchId) {
        //     this.imageCaching = await this.getImagesBuffer(props.pages)
        //     this.lastFetchId = props.chapterTitle
        // }
        const fprops: FormatProps = {
            path: props.format === DownloadFormat.img ? downloadDir : path.join(downloadDir, sanitize(props.chapterTitle)),
            pages: props.pages.map(e=>  ({
                url:  e.src,
                index: parseInt(e.page_index)}
            ))
        }
        try{
            switch (props.format) {
                case DownloadFormat.pdf:
                    await this.pdf(fprops, fromCache)
                break
            case DownloadFormat.cbz:
                await this.cbz(fprops, fromCache)
                break
                case DownloadFormat.zip:
                await this.zip(fprops, fromCache)
                break
            case DownloadFormat.img:
                await this.images(fprops, fromCache)
                break
        }
        this.event.emit('done', props.format, '', 3)
        }catch(e){
            if(e instanceof Error){
                this.event.emit('error', e.message)
            }
        }
        
    }

}