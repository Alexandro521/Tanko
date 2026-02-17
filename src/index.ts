#!/usr/bin/env node
import fs from 'fs'
import fsp from 'fs/promises'
import chalk from 'chalk'
import path from 'path'
import { firefox, request } from "playwright";
import ora from "ora"
import ansiEscapes from 'ansi-escapes'
import { History } from "./functions/history.js";
import { MangaServerClient } from "./server/leerCapitulo.js";
import { init } from "./frontend/menu.js";
import { BASE_DIR,DATA_DEFAULT_DIR,DOWNLOADS_DEFAULT_DIR, LAUNCH_OPTIONS, TEMP_DIR} from './const.js'
let spin = ora()

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

spin.start("init browser...")

try{
  History.load() //load read history from disk

  const context = await firefox.launchPersistentContext(
    path.join(TEMP_DIR, 'tanko', 'browser'),
    LAUNCH_OPTIONS);
  
  await context.addInitScript(() => {
    const storageData = [
      { name: "display_mode", value: "1" },
      { name: "pic_style", value: "0" }
    ];

    if (window.location.hostname.includes('leercapitulo.co')) {
      storageData.forEach(item => {
        window.localStorage.setItem(item.name, item.value);
      });
    }
  });
  
  const page =  context.pages()[0] || await context.newPage();
  
  page.route('**/*', route => {
    const requestType = route.request().resourceType();
    if (requestType === 'script' && route.request().frame() !== page.mainFrame()) {
        return route.abort();
      }
      //block unnecessary resources to speed up loading times
      if(['font', 'image', 'media', 'beacon'].includes(requestType)){
        route.abort()
      }else{
        route.continue()
      }
    })
    
    const Server = new MangaServerClient(page)
    spin.stop()
    init(Server, context, page);

}catch(e:any){
  if(e.message.includes("Executable doesn't exist")){
    console.log(chalk.redBright('Error: El navegador Firefox Playwright no esta instalado'))
    console.log(chalk.blueBright('Por favor ejecutar el comando: '), chalk.greenBright('npx playwright install firefox'))
  }
}
