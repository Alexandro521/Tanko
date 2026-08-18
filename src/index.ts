#!/usr/bin/env node
import fs from 'fs'
import fsp from 'fs/promises'
import ansi from 'ansi-escapes'
import { History } from "./functions/history.js";
import { main } from "./cli/menu.js";
import {
  BASE_DIR,
  BROWSER_STORAGE_PATH,
  DATA_DEFAULT_DIR,
  DOWNLOADS_DEFAULT_DIR,
  FIRST_INIT_MESSAGE,
  HISTORY_PATH,
  WELCOME_MESSAGE
} from './const.js'
import { Configuration } from './functions/configuration.js';
import { Notify, NotifyType } from './functions/notify.js';
import { versionChecker } from './scripts.js';
import { TerminalControl } from './functions/reader.js';
import { stdout } from 'process';
import ora from 'ora';

const loader = ora()
await TerminalControl.getWindowDimension()
stdout.write(ansi.enterAlternativeScreen);

loader.start('starting...')
if (!fs.existsSync(BASE_DIR)) {
  await fsp.mkdir(BASE_DIR, { recursive: true })
}
if (!fs.existsSync(DOWNLOADS_DEFAULT_DIR)) {
  await fsp.mkdir(DOWNLOADS_DEFAULT_DIR, { recursive: true })
}
if (!fs.existsSync(DATA_DEFAULT_DIR)) {
  await fsp.mkdir(DATA_DEFAULT_DIR, { recursive: true })
}
if (!fs.existsSync(HISTORY_PATH)) {
  await fsp.writeFile(HISTORY_PATH, JSON.stringify({ last_update: Date.now(), history: [] }))
}
if (!fs.existsSync(BROWSER_STORAGE_PATH)) {
  await fsp.mkdir(BROWSER_STORAGE_PATH, { recursive: true })
}
const notify = Notify.getInstace()
const confInstance = await Configuration.getInstance()
await versionChecker()
await History.load()

confInstance.on('browserinit', async () => {
  if (loader.isSpinning) loader.stop()
  const lang = await confInstance.getLanguageInterface()
  loader.start(lang.loading_states.browser_init)
})
confInstance.on('browserload', () => {
  loader.stop()
})
confInstance.on('browserclosing', async () => {
  const lang = await confInstance.getLanguageInterface()
  if (loader.isSpinning) loader.stop
  loader.start(lang.loading_states.browser_close)
})
confInstance.on('browserclose', () => {
  loader.stop()
})
confInstance.on('error', (e) => {
  loader.stop()
  Notify.pushError(e)
})

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


