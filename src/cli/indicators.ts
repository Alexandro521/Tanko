import { progressBar, type ProgresBarOptions } from "../utils.ts";
import ansi from 'ansi-escapes'
import { stdout } from "node:process";
import { Notify } from "../functions/notify.ts";
import type { Downloader } from "../functions/downloader.ts";

export function dowloadProgress (downloader: Downloader, mangaTitle: string, chapterTitle:  string, pagesLength: number){
let reicevedCounter = 0
let processedCounter = 0
let doneCounter = 0
let errorCounter = 0
let reicevedAc = 0
let total = pagesLength

downloader.event.on('received', (_, __, byteLength)=>{
    reicevedCounter++;
    reicevedAc+=byteLength
})
downloader.event.on('processing', ()=>{
    processedCounter++;
})
downloader.event.on('fetch-error', ()=>{
    errorCounter++
    total--
})
downloader.event.on('processing-done', ()=>{
    doneCounter++;
})

downloader.event.on('processing-fail', ()=>{
    total--;
    errorCounter++
})
downloader.event.on('error', (message)=>{
    Notify.pushError(new Error(message))
})
downloader.event.on('done', ()=>{
    clearInterval(drawInterval)
})
const time = Date.now()
const progressBarOptions: ProgresBarOptions = {
        progress: 50,
        length: 50,
        defaultChar: '━',
        percentColor: 'auto',
        showProgress: true,
        progressColor: {
            0: 'red',
            25: 'yellow',
            40: 'yellowBright',
            60: 'green',
            75: 'greenBright',
            85: 'cyan',
            90: 'cyanBright'
        }
}
let firstRender = true
const drawInterval = setInterval(()=>{
    const ntime = Date.now()
    const secondsElapsed = Math.floor((ntime - time)/1000)
    let seconds = secondsElapsed % 60
    let minutes = Math.floor(secondsElapsed/60) % 60
    let timeString = minutes.toString().padStart(2, '0')  + ':'+seconds.toString().padStart(2, '0') + (minutes > 0 ? 'm':'s')
    const progress = {
        fetch: ((reicevedCounter*100)/total),
        process: ((processedCounter*100)/total),
        done: ((doneCounter*100)/total),
    }

    const lines = [
        ' Downloading - ' + mangaTitle + ' '+ chapterTitle ,
        progressBar({...progressBarOptions, progress: progress.fetch }),
        progressBar({...progressBarOptions, progress: progress.process}),
        progressBar({...progressBarOptions, progress: progress.done}),
        timeString + 
        ` ࢈ Downloaded ${(reicevedAc/1024/1024).toFixed(1)}MB ࢈ ` +
        `Received ${reicevedCounter} ࢈ ` +
        `Fails ${errorCounter} ࢈ ` + 
        `Remaining ${total - doneCounter}`, ''
    ]
    if(!firstRender){
        stdout.write(ansi.eraseLines(lines.length))
    }
    firstRender = false
    stdout.write(lines.join('\n'))
}, 1000 / 12)
}