import fs from 'fs'
import path from 'path';
import sharp from 'sharp';
import os from 'os'
import type { ChapterPage } from '../types.js';
import sanitize from 'sanitize-filename';
import ora from 'ora';
import PDFDocument from 'pdfkit'
const spin = ora();

const PDFOptions: PDFKit.PDFDocumentOptions = {
    margin: '0',
    compress: true,
    autoFirstPage: false,
    subset: 'PDF/A-1a',
    tagged: true,
    pdfVersion: '1.4',
    info: {
        Author: 'tu manga CLI',
        Keywords: 'manga, manga reader, cli',
    }
}

export async function downloadChapter(mangaTitle: string, chapterTitle: string, srcs: ChapterPage[]) {
    try {
        spin.start(`Download pages...`)
        const dir = makeDir('pdf', mangaTitle) ?? './';
        const doc = new PDFDocument(PDFOptions)
        doc.pipe(fs.createWriteStream(`${dir}/${sanitize(chapterTitle)}.pdf`));
        let progressCounter = 0;
        let pageImages =  await Promise.all(srcs.map(async (image, index) => {

            if (image.src === 'undefined') throw new Error('download failed');
            const data = await fetch(image.src)
            if(!data.ok) throw new Error('Error al descargar el capitulo')
                //convert webp buffer to jpeg buffer
            const buffer = await sharp(await data.arrayBuffer()).jpeg({quality: 100, optimiseCoding: true}).toBuffer({resolveWithObject:true});
            spin.text = `Download images [${progressCounter}/${srcs.length}] page #${image.page_index}`
            progressCounter++;
            return {index, buffer};
        }))
        //sort buffer pages;
        pageImages = pageImages.sort((a,b)=> a.index -  b.index);
        progressCounter = 1;
        for(let {buffer, index} of pageImages){

            const {height, width} = buffer.info;
            const page = doc.addPage({size: [width, height],margin: '0%' })
            page.image(buffer.data, {align: 'center',cover: [width,height] })
            spin.text = `Making PDF ${(progressCounter*pageImages.length)/100}%... append image #${index}`
            progressCounter++;
        }
        doc.end();
        spin.succeed(`${chapterTitle} download succesfully`);

    } catch (e) {
        spin.fail('x download failed');
        console.log(e)
    }
}

export function makeDir(...name: string[]) {
    try {
        const basedir = path.resolve(os.homedir(), 'tanko')
        const targetDir = path.join(basedir, 'download', ...(name.map((n) => sanitize(n).replaceAll(' ', '-'))))
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