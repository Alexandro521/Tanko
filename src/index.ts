#!/usr/bin/env node
import os from 'os'
import fs from 'fs'
import fsp from 'fs/promises'
import chalk from 'chalk'
import path from 'path'
import { firefox } from "playwright";
import ora from "ora"
import ansiEscapes from 'ansi-escapes'
import { History } from "./functions/history.js";
import { MangaServerClient } from "./server/leerCapitulo.js";
import { init } from "./frontend/menu.js";

const BASE_URL = path.resolve(os.homedir(), 'tanko')
const DOWNLOADS_DEFAULT_URL = path.resolve(BASE_URL, 'downloads')
const DATA_URL = path.resolve(BASE_URL, 'data')

if(!fs.existsSync(BASE_URL)) {
   await fsp.mkdir(BASE_URL, {recursive: true})
}
if(!fs.existsSync(DOWNLOADS_DEFAULT_URL)){
    await fsp.mkdir(DOWNLOADS_DEFAULT_URL,{recursive:true})
}

if(!fs.existsSync(DATA_URL)){
    await fsp.mkdir(DATA_URL,{recursive:true})
    await fsp.writeFile(path.resolve(DATA_URL,'read_history.json'), JSON.stringify({last_update: Date.now(), History: []}) )
}

const browserStorage = {
  "cookies": [
  ],
  "origins": [
    {
      "origin": "https://www.leercapitulo.co",
      "localStorage": [
        {
          "name": "display_mode",
          "value": "1"
        },
        {
          "name": "pic_style",
          "value": "0"
        }
      ]
    }
  ]
}
console.log(ansiEscapes.clearTerminal)

let spin = ora('cargando...')

spin.start("init browser...")

try{
  const browser = await firefox.launch({
    headless: true,
  });

  const context = await browser.newContext({
    javaScriptEnabled: true,
    storageState: browserStorage,
  })

  History.load()
  const page = await context.newPage();
  const Server = new MangaServerClient(page)
  spin.stop()
  init(Server, browser, page, context);
}catch(e:any){
  if(e.message.includes("Executable doesn't exist")){
    console.log(chalk.redBright('Error: El navegador Firefox Playwright no esta instalado'))
    console.log(chalk.blueBright('Por favor ejecutar el comando: '), chalk.greenBright('npx playwright install firefox'))
  }
}