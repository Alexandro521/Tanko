import fs from 'fs'
import fsp from 'fs/promises'
import sharp from 'sharp';
import ora from 'ora';
import chalk from 'chalk';
import path from 'path';
import sanitize from 'sanitize-filename';
import ansi from 'ansi-escapes'
import PDFDocument from 'pdfkit'
import { DOWNLOADS_DEFAULT_DIR } from '../const.js';
import { Configuration } from './configuration.js';
import { Notify, NotifyType } from './notify.js';
import { makeDir } from '../utils.js';
import { EventEmitter } from 'events';
import { DownloadFormat } from '../types/enum.js';
import type { ChapterPage, DownloadPageProps, DownloadProps, FormatProps, ImgBuffer } from '../types/types.js';
import { ZipArchive } from "archiver"
import { ConfigurationEvents } from '../types/enum.js';

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
const noti = Notify.getInstace()
const config = await Configuration.getInstance()
let { loading_states, err_messages } = await config.getLanguageInterface()
config.on(ConfigurationEvents.updateLanguage, async () => {
    const lang = await config.getLanguageInterface()
    loading_states = lang.loading_states
    err_messages = lang.err_messages
})

export class Downloader extends EventEmitter {
    private static instance: Downloader;
    private constructor() {
        super()
    }
    private imageCaching!: DownloadPageProps[] | undefined
    public lastFetchId!: string | undefined;

    private async getImagesBuffer(images: ChapterPage[]) {
        const contentRexp = new RegExp(/image\/(webp|jpeg|png)/)
        const fetchImage = async (img: ChapterPage, index: number): Promise<DownloadPageProps> => {
            return new Promise(async (resolve, reject) => {
                const res = await fetch(img.src)
                const contentType = res.headers.get('Content-Type') ?? ''
                if (!res.ok) reject(err_messages.fetching.msg)
                else if (!contentRexp.test(contentType)) reject(`Invalid mime type ${contentType}`)
                let buffImg: ImgBuffer =
                    await sharp((await res.arrayBuffer()))
                        .jpeg()
                        .toBuffer({ resolveWithObject: true });
                this.emit('download_page', index)
                resolve({ index, data: buffImg })
            })
        }
        const pagesBuffer = await Promise.all(images.map(fetchImage))
        return pagesBuffer
    }
    private async pdf({ pages, path }: FormatProps) {
        this.emit('state', 'making pdf file')
        const doc = new PDFDocument(PDFOptions)
        doc.pipe(fs.createWriteStream(`${path}.pdf`))
        pages = pages.sort((a, b) => a.index - b.index);
        for (const { data } of pages) {
            const { height, width } = data.info;
            const page = doc.addPage({ size: [width, height], margin: '0%' })
            page.image(data.data, { align: 'center', cover: [width, height] })
        }
        this.emit('done')
        doc.end();
    }
    private async images(props: FormatProps) {
        const dir = await fsp.mkdir(props.path, {recursive: true})
        if(!dir) return
        await Promise.all(props.pages.map(async page=>{
            await fsp.writeFile(`${path.join(dir, `Page ${page.index +1}`)}.jpeg`, page.data.data)
        }))
        this.emit('done')
    }
    private async cbz(props: FormatProps) {
        await this.zip(props, 'cbz')
    }
    private async zip({ pages, path }: FormatProps, format = 'zip') {
        const writeStream = fs.createWriteStream(`${path}.${format}`)
        const archive = new ZipArchive({
            zlib: { level: 4 },
        })
        this.emit('state', 'compresing')
        archive.on('error', (err) => {
            writeStream.close()
            throw err
        })
        writeStream.on('close', () => {
            writeStream.close()
        })
        archive.pipe(writeStream)
        for (const { data, index } of pages) {
            archive.append(
                data.data,
                { name: `Page ${index + 1}` }
            )
        }
        archive.finalize()
    }

    static getInstance() {
        if (!this.instance) {
            this.instance = new Downloader();
        }
        return this.instance
    }
    async free() {
        this.imageCaching = undefined
        this.lastFetchId = undefined
    }
    async download(props: DownloadProps) {
        const downloadDir = await makeDir(
            DOWNLOADS_DEFAULT_DIR,
            props.format,
            props.serverName,
            props.mangaTitle,
        ) 
        if (!this.imageCaching || props.chapterTitle !== this.lastFetchId) {
            this.imageCaching = await this.getImagesBuffer(props.pages)
            this.lastFetchId = props.chapterTitle
        }
        const fprops: FormatProps = {
            pages: this.imageCaching,
            path: path.join(downloadDir, sanitize(props.chapterTitle))
        }
        switch (props.format) {
            case DownloadFormat.pdf:
                await this.pdf(fprops)
                break
            case DownloadFormat.cbz:
                await this.cbz(fprops)
                break
            case DownloadFormat.zip:
                await this.zip(fprops)
                break
            case DownloadFormat.img:
                await this.images(fprops)
                break
        }
        noti.push({
            title: 'Download complete',
            type: NotifyType.event,
            message:
                `${props.mangaTitle} chapter, ${ansi.link(chalk.underline.blueBright(props.chapterTitle), downloadDir)} downloaded`
        })
    }
}