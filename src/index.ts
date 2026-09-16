#!/usr/bin/env node
import fsp from 'fs/promises'
import ansi from 'ansi-escapes'
import { main } from "./cli/menu.ts";
import {
  BASE_DIR,
  BROWSER_STORAGE_PATH,
  DATA_DEFAULT_DIR,
  DOWNLOADS_DEFAULT_DIR,
  FIRST_INIT_MESSAGE,
  WELCOME_MESSAGE
} from './const.ts'
import { Configuration } from './functions/configuration.ts';
import { Notify, NotifyType } from './functions/notify.ts';
import { versionChecker } from './scripts.ts';
import { TerminalControl } from './functions/reader.ts';
import { stdout } from 'process';
import ora from 'ora';

const loader = ora()
await TerminalControl.getWindowDimension()
stdout.write(ansi.enterAlternativeScreen);

loader.start('starting...')
versionChecker()
async function createPathIfNotExists(path: string){
  return new Promise(async (resolve)=>{
    try{
      await fsp.access(path)
      resolve(path)
    }catch(e){
      await fsp.mkdir(path, {recursive: true})
      resolve(path)
    }
  })
}

try {
  await Promise.all(
    [
    createPathIfNotExists(BASE_DIR),
    createPathIfNotExists(DOWNLOADS_DEFAULT_DIR),
    createPathIfNotExists(DATA_DEFAULT_DIR),
    createPathIfNotExists(BROWSER_STORAGE_PATH)
  ]
)
}catch(e){
  if(e instanceof Error){
    Notify.pushError(e)
  }
}

const notify = Notify.getInstace()
const confInstance = await Configuration.getInstance()

if (confInstance.settings.tanko_isFirstRun) {
  notify.push({
    title: 'Welcome!',
    type: NotifyType.message,
    message: FIRST_INIT_MESSAGE
  })
  confInstance.settings.tanko_isFirstRun = false
}

loader.stop()
stdout.write(WELCOME_MESSAGE);
await main()
await confInstance.conf_browser.close()
await confInstance.store()
stdout.write(ansi.exitAlternativeScreen);
process.exit(0)


