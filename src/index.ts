#!/usr/bin/env node
import fs from 'fs'
import fsp from 'fs/promises'
import ansi from 'ansi-escapes'
import ansiEscapes from 'ansi-escapes'
import { History } from "./functions/history.js";
import { main } from "./cli/menu.js";
import { BASE_DIR, BROWSER_STORAGE_PATH, DATA_DEFAULT_DIR, DOWNLOADS_DEFAULT_DIR, HISTORY_PATH, WELCOME_MESSAGE } from './const.js'
import { Configuration } from './functions/configuration.js';
import { Notify, NotifyType } from './functions/notify.js';
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
if (!fs.existsSync(HISTORY_PATH)) {
  await fsp.writeFile(HISTORY_PATH, JSON.stringify({ last_update: Date.now(), history: [] }))
}
if (!fs.existsSync(BROWSER_STORAGE_PATH)) {
  await fsp.mkdir(BROWSER_STORAGE_PATH, {recursive: true})
}

console.log(ansi.clearViewport);
console.log(WELCOME_MESSAGE);
await History.load() 
const confInstance = await Configuration.getInstance()
const notify = Notify.getInstace()
await main(confInstance)
await confInstance.closeBrowser();
await confInstance.writeConfigFile()
process.exit(0)
