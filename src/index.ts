#!/usr/bin/env node
import fs from 'fs'
import fsp from 'fs/promises'
import path from 'path'
import ansiEscapes from 'ansi-escapes'
import { History } from "./functions/history.js";
import { init } from "./cli/menu.js";
import { BASE_DIR,DATA_DEFAULT_DIR,DOWNLOADS_DEFAULT_DIR} from './const.js'
import { Configuration } from './functions/configuration.js';


console.log(ansiEscapes.clearTerminal)

if(!fs.existsSync(BASE_DIR)) {
  await fsp.mkdir(BASE_DIR, {recursive: true})
}

if(!fs.existsSync(DOWNLOADS_DEFAULT_DIR)){
  await fsp.mkdir(DOWNLOADS_DEFAULT_DIR,{recursive:true})
}

if(!fs.existsSync(DATA_DEFAULT_DIR)){
  await fsp.mkdir(DATA_DEFAULT_DIR,{recursive:true})
  await fsp.writeFile(path.resolve(DATA_DEFAULT_DIR,'read_history.json'), JSON.stringify({last_update: Date.now(), History: []}) )
}

History.load() 
await init()
