#!/usr/bin/env node
import fs from 'fs'
import fsp from 'fs/promises'
import ansiEscapes from 'ansi-escapes'
import { History } from "./functions/history.js";
import { main } from "./cli/menu.js";
import { BASE_DIR,DATA_DEFAULT_DIR,DOWNLOADS_DEFAULT_DIR} from './const.js'

console.log(ansiEscapes.clearTerminal)

if(!fs.existsSync(BASE_DIR)) {
  await fsp.mkdir(BASE_DIR, {recursive: true})
}
if(!fs.existsSync(DOWNLOADS_DEFAULT_DIR)){
  await fsp.mkdir(DOWNLOADS_DEFAULT_DIR,{recursive:true})
}
if(!fs.existsSync(DATA_DEFAULT_DIR)){
  await fsp.mkdir(DATA_DEFAULT_DIR,{recursive:true}) 
}

await History.load() 
await main()
