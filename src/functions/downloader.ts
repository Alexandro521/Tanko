import fs from 'fs'
import sharp from 'sharp';
import ora from 'ora';
import chalk from 'chalk';
import path from 'path';
import sanitize from 'sanitize-filename';
import ansi from 'ansi-escapes'
import PDFDocument from 'pdfkit'
import { DOWNLOADS_DEFAULT_DIR } from '../const.js';
import { Configuration, ConfigurationEvents } from './configuration.js';
import { Notify, NotifyType } from './notify.js';
import { makeDir } from '../utils.js';
import { EventEmitter } from 'events';
import { DownloadFormat } from '../types/enum.js';
import type { ChapterPage, DownloadProps, FormatProps, ImgBuffer } from '../types/types.js';

const spin = ora();
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
config.on(ConfigurationEvents.updateLanguage, async ()=>{
    const lang = await config.getLanguageInterface()
    loading_states = lang.loading_states
    err_messages = lang.err_messages
})

export class Downloader extends EventEmitter{
    private static instance: Downloader;
    private constructor(){
        super()
    }
    private async getImagesBuffer(images: ChapterPage[]) {
        const contentRexp = new RegExp(/image\/(webp|jpeg|png)/)
        const fetchImage = async (img: ChapterPage, index: number): Promise<{index: number, data: ImgBuffer}> => {
            return new Promise(async (resolve, reject) => {
                const res = await fetch(img.src)
                const contentType = res.headers.get('Content-Type') ?? ''
                if (!res.ok) reject(err_messages.fetching.msg)
                else if (!contentRexp.test(contentType)) reject(`Invalid mime type ${contentType}`)
                let buffImg: ImgBuffer = 
                await sharp((await res.arrayBuffer()))
                    .jpeg()
                    .toBuffer({ resolveWithObject: true });
                
                this.emit('download_page',index)
                resolve({ index, data: buffImg })
            })
        }
        const pagesBuffer = await Promise.all(images.map(fetchImage))
        return pagesBuffer
    }
    private async pdf(props: FormatProps){
        let images = await this.getImagesBuffer(props.pages);
        this.emit('onpdf')
        const doc = new PDFDocument(PDFOptions)
        doc.pipe(fs.createWriteStream(`${props.path}.pdf`))
        images = images.sort((a, b) => a.index - b.index);
        for (const { data } of images) {
            const { height, width } = data.info;
            const page = doc.addPage({ size: [width, height], margin: '0%' })
            page.image(data.data, { align: 'center', cover: [width, height] })
        }
        this.emit('done')
        doc.end();
    }
    private async images(props: FormatProps) {

    }
    private async cbz(props: FormatProps) {

    }
    private async zip(props: FormatProps) {

    }
    static getInstance(){
        if(!this.instance){
            this.instance = new Downloader();
        }
        return this.instance
    }
    async download(props: DownloadProps) {
            const downloadPath = await makeDir(
                DOWNLOADS_DEFAULT_DIR,
                props.format,
                props.serverName,
                props.mangaTitle,
            )
            const fprops: FormatProps = {
                pages: props.pages,
                path: path.join(downloadPath, sanitize(props.chapterTitle))
            }
            switch(props.format){
                case DownloadFormat.pdf:
                    await this.pdf(fprops)
                case DownloadFormat.cbz:
                    await this.cbz(fprops)
                case DownloadFormat.zip: 
                    await this.zip(fprops)
                case DownloadFormat.img: 
                    await this.images(fprops)
            }
            noti.push({
                title: 'Download complete',
                type: NotifyType.event,
                message:
                    `${props.mangaTitle} chapter, ${ansi.link(chalk.underline.blueBright(props.chapterTitle), downloadPath)} downloaded`
            })
    }
}