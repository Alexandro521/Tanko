#!/usr/bin/env node
import fs from 'fs'
import fsp from 'fs/promises'
import ansi from 'ansi-escapes'
import { main } from "./cli/menu.ts";
import {
  BASE_DIR,
  BROWSER_STORAGE_PATH,
  DATA_DEFAULT_DIR,
  DOWNLOADS_DEFAULT_DIR,
  FIRST_INIT_MESSAGE,
  HISTORY_PATH,
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
await Promise.all(
  [
    !fs.existsSync(BASE_DIR) ? 
      fsp.mkdir(BASE_DIR, { recursive: true }) : undefined,
    !fs.existsSync(DOWNLOADS_DEFAULT_DIR) ? 
      fsp.mkdir(DOWNLOADS_DEFAULT_DIR, { recursive: true }) : undefined,
    !fs.existsSync(DATA_DEFAULT_DIR) ?  
      fsp.mkdir(DATA_DEFAULT_DIR, { recursive: true }) : undefined,
    !fs.existsSync(HISTORY_PATH) ? 
      fsp.writeFile(HISTORY_PATH, JSON.stringify({ last_update: Date.now(), history: [] })) : undefined,
    !fs.existsSync(BROWSER_STORAGE_PATH) ? 
      fsp.mkdir(BROWSER_STORAGE_PATH, { recursive: true }) : undefined,
  ]
)
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
await main(confInstance)
await confInstance.conf_browser.close()
await confInstance.store()
stdout.write(ansi.exitAlternativeScreen);
process.exit(0)


