import fs from 'fs'
import path from 'path';
import sharp from 'sharp';
import sanitize from 'sanitize-filename';
import ora from 'ora';
import PDFDocument from 'pdfkit'
import type { ChapterPage } from '../types/types.js';
import { DOWNLOADS_DEFAULT_DIR } from '../const.js';
import { Configuration } from './configuration.js';
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

const cfgInst = await Configuration.getInstance()

export async function downloadChapter(mangaTitle: string, chapterTitle: string, srcs: ChapterPage[]) {
  try {
        const {loading_states, err_messages} = cfgInst.getLang()
        spin.start(loading_states.downloading_pages + '...')
        const dir = makeDir('pdf', mangaTitle) ?? './';
        const pdf = new PDFDocument(PDFOptions)
        pdf.pipe(fs.createWriteStream(`${dir}/${sanitize(chapterTitle)}.pdf`));
        let progressCounter = 0;
        let pageImages =  await Promise.all(srcs.map(async (image, index) => {
            if (image.src === 'undefined') throw new Error(err_messages.pdf_make.msg);
            const data = await fetch(image.src)
            if(!data.ok) throw new Error('Error al descargar el capitulo')
                //convert webp buffer to jpeg buffer
            const buffer = await sharp(await data.arrayBuffer()).jpeg({quality: 100, optimiseCoding: true}).toBuffer({resolveWithObject:true});
            spin.text = `${loading_states.downloading_pages} [${progressCounter}/${srcs.length}] page #${image.page_index}`
            progressCounter++;
            return {index, buffer};
        }))
        //sort buffer pages;
        pageImages = pageImages.sort((a,b)=> a.index -  b.index);
        progressCounter = 1;
        for(let {buffer, index} of pageImages){

            const {height, width} = buffer.info;
            const page = pdf.addPage({size: [width, height],margin: '0%' })
            page.image(buffer.data, {align: 'center',cover: [width,height] })
            spin.text = `Making PDF ${(progressCounter*pageImages.length)/100}%... append image #${index}`
            progressCounter++;
        }
        pdf.end();
        spin.succeed(`${chapterTitle} download succesfully`);

    } catch (e) {
        spin.fail('x download failed');
        console.log(e)
    }
}

export function makeDir(...name: string[]) {
    try {
    
        const targetDir = path.join(DOWNLOADS_DEFAULT_DIR, ...(name.map((n) => sanitize(n).replaceAll(' ', '-'))))
        if (!fs.existsSync(targetDir)) {
            fs.mkdir(
                targetDir,
                { recursive: true, },
                (err) => {
                    if (err) {

                        console.log(JSON.stringify(err));
                    }
                }
            )
        }
        return targetDir
    } catch (e) {
        console.log('error')
    }
}