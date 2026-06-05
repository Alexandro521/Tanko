import { mangaServerRegister } from "../clients/port.js";
import type { LangInterface } from "../types/lang.js";
import type { ConfigurationInterface, MangaServerInterface } from "../types/types.js";
import chalk from "chalk";
import fs from "fs";
import fsPromise from "fs/promises";
import ora from "ora";
import path from "path";
import { type BrowserContext, firefox, type Page } from "playwright";
import { CONFIG_FILE_PATH, DOWNLOADS_DEFAULT_DIR, LAUNCH_OPTIONS, TEMP_DIR } from "../const.js";
import { lang } from "./lang.js";
import EventEmitter from "events";
const spin = ora()

export class Configuration extends EventEmitter {
    private static confInstance: Configuration
    private browser: BrowserContext | null = null
    private client!: MangaServerInterface
    private lang!: LangInterface
    private context!: Page 
  
    private config: ConfigurationInterface = {
        downloads_path: DOWNLOADS_DEFAULT_DIR,
        deepSearch: false,
        language: 'es',
        client: mangaServerRegister.mangadex,
        favoriteChapterLang: 'any',
        historyMaxSize: 256,
        historyServerFilter: true,
        imageCacheMaxSize: '64'
    }
  
    private constructor() {
        super()
    }

    static async getInstance() {
        if (!this.confInstance) {
            this.confInstance = new Configuration()
            await this.confInstance.load()
            return this.confInstance
        }
        return this.confInstance
    }
  
    get configuration(){
        return this.config
    }
    async loadBrowser() {
        try {
            spin.start('Loading browser...')
            this.browser = await firefox.launchPersistentContext(
              path.join(TEMP_DIR, 'tanko', 'browser'), LAUNCH_OPTIONS);
            spin.stop()
            await this.browser.addInitScript(() => {
              /*for leercapitulo.co */
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

            this.context = this.browser.pages()[0] || await this.browser.newPage();
            this.context.route('**/*', route => {
                const requestType = route.request().resourceType();

                if (requestType === 'script' && route.request().frame() !== this.context.mainFrame()) {
                    return route.abort();
                }
                //block unnecessary resources to speed up loading times
                if (['font', 'image', 'media', 'beacon'].includes(requestType)) {
                    route.abort()
                } else {
                    route.continue()
                }
            })
        } catch (e: any) {
            if (e.message.includes("Executable doesn't exist")) {
                spin.fail(chalk.redBright('Error: El navegador Firefox Playwright no esta instalado'))
                console.log(chalk.yellowBright('para instalar el navegador por favor ejecute: '), chalk.gray('npx playwright install firefox'))
            }
        }
    }
  
    async closeBrowser() {
        try {
            if(!this.browser) return
            spin.start('Closing browser...')
            await this.context.close()
            await this.browser.close()
            spin.stop()
            this.browser = null
            this.emit('close')
        } catch (e) {
            if(spin.isSpinning) spin.stop()
            console.log(e)
        }
    }
    
    async load(conf: ConfigurationInterface | null = null) {
        try {

            if (fs.existsSync(CONFIG_FILE_PATH) && !conf) {
                const confJSON = (await fsPromise.readFile(CONFIG_FILE_PATH)).toString()
                this.config = await JSON.parse(confJSON) as ConfigurationInterface
            }
            if(this.config.language)
              this.lang = lang[this.config.language]
            if (this.config.client.need_browser && !this.browser) {
                await this.loadBrowser()
            }else if(!this.config.client.need_browser && this.browser){
                await this.closeBrowser()
            }
          /* */
            if (
                (!this.context || !this.browser) &&
                this.config.client.need_browser
            ) throw new Error('Error on browser loading')
            this.client = (mangaServerRegister[this.config.client.name].client)(this.context)
            this.emit('load', this.config, this.client, this.context,this.browser)
        } catch (e) {
            console.log(e)
        }
    }
    async store() {
        try {
            await fsPromise.writeFile(
                CONFIG_FILE_PATH,
                JSON.stringify(this.config, null, '\t'))
        } catch (e) {
            console.log(e)
        }
    }
    getLang() {
        return this.lang
    }
    getContext() {
        if (this.context)
            return this.context
        return null
    }
    getClient() {
        return this.client 
    }
    async setConfig(conf: ConfigurationInterface) {
        if(conf)
        await this.load(conf)
        await this.store()
        this.emit('update', this.config, this.client, this.lang)
    }
}