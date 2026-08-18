import {LocalTracker, type LocalTrackerProps} from '../trackers/local'
import chalk from 'chalk'
import fs from 'fs/promises'
import { stdout } from 'process'
const tracker = LocalTracker.getInstance()
const blockSize = process.argv[3] ? Number(process.argv[3]) : 32
type testhadle = (bitIndex: number) => Promise<number>

const props: LocalTrackerProps = {
    chapterIndex: 0,
    chapterCount: 256,
    mangaId: 'Debug'
}

const writeTestList: testhadle[] = [
    async (bitIndex) => {
        for (let i = bitIndex; i < bitIndex + blockSize; i++) {
            await tracker.markAsRead({...props, chapterIndex: i})
        }
        return 0xFFFFFFFF
    },
    async (bitIndex) => {
        for (let i = bitIndex; i < bitIndex + blockSize; i++) {
            if(i%2){
                await tracker.markAsRead({...props, chapterIndex: i})
            }
        }
        return 0xFFFFFFFF
    },
    async (bitIndex) => {
        for (let i = bitIndex; i < bitIndex + blockSize; i++) {
            if (!(i % 2)) {
                await tracker.markAsRead({ ...props, chapterIndex: i })
            }
        } 
        return 0xFFFFFFFF
    },    async (bitIndex) => {
        for (let i = bitIndex; i < bitIndex + blockSize; i++) {
            if (i % 2 && i%3) {
                await tracker.markAsRead({ ...props, chapterIndex: i })
            }
        } 
        return 0xFFFFFFFF
    },async (bitIndex) => {
        for (let i = bitIndex; i < bitIndex + blockSize; i++) {
            if ((i % 2 && !(i%3))) {
                await tracker.markAsRead({ ...props, chapterIndex: i })
            }
        } 
        return 0xFFFFFFFF
    },async (bitIndex) => {
        for (let i = bitIndex; i < bitIndex + blockSize; i++) {
            if ((!(i % 2) && i%3)) {
                await tracker.markAsRead({ ...props, chapterIndex: i })
            }
        } 
        return 0xFFFFFFFF
    }
]

const maskArr = new Uint32Array(writeTestList.length)
let buffer: Uint8Array | Uint16Array | Uint32Array

await tracker.regist(props)
for(let i = 0; i < writeTestList.length; i++){
    const test = writeTestList[i]
    const mask = await test(blockSize * i)
    maskArr[i] = mask
}
const file = await fs.open( process.argv[2] ?? tracker.getFilePath(props.mangaId))
const stats = await file.stat()

if (blockSize === 16)
    buffer = new Uint16Array(stats.size >> 2)
else if (blockSize === 32)
    buffer = new Uint32Array(stats.size >> 3)
else
    buffer = new Uint8Array(stats.size)

await file.read(buffer)

const headerStr = 
'  n '+ 
('⎹ binary').padEnd(blockSize +1, ' ') + 
('⎹ Decimal').padEnd(12, ' ') +
('⎹ Hex').padEnd(9, ' ') +
('⎹ Octal').padEnd(12, ' ') +
('⎹ Range').padEnd(12, ' ') + '\n'

process.stdout.write
(
    chalk.bgMagenta(headerStr)
)
for(let i = 0; i < buffer.length; i++){
    let binFormat: string , range: string, octal: string, hex : string
    const chunck = buffer[i]
    binFormat = (chunck.toString(2).padStart(blockSize, '0')).split('').map((e)=>e==='0'? chalk.redBright(e): chalk.greenBright(e)).join('');
    range = `${chalk.blue(blockSize*i)}...${chalk.blueBright(i*blockSize+blockSize)}`;
    octal = chunck.toString(8);
    hex =  chunck.toString(16);
    process.stdout.write
    (  ' '+
        chalk.gray(String(i).padStart(2, '0').padEnd(3,' '))+
        binFormat +'  '+
        chalk.yellow(    chunck.toString().padEnd(12, ' '))+
        chalk.magentaBright(hex.padEnd(9, ' ') )+
        chalk.red(octal.padEnd(12, ' '))+
        range.padEnd(7, ' ')  +
        '\n'
    )
}


await file.close()