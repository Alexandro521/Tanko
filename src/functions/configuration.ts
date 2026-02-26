import { mangaServerRegister } from "../clients/port.js";
import type { LangInterface } from "../types/lang.js";
import type { ConfigurationInterface, MangaServerInterface } from "../types/types.js";
import chalk from "chalk";
import fs from "fs";
import fsPromise from "fs/promises";
import ora from "ora";
import path from "path";
import { type BrowserContext, firefox, type Page } from "playwright";
import { z } from "zod";
import { CONFIG_FILE_PATH, DOWNLOADS_DEFAULT_DIR, LAUNCH_OPTIONS, TEMP_DIR } from "../const.js";
import { lang } from "./lang.js";
import EventEmitter from "events";

const schema = z.object({
    deepSearch: z.boolean(),
    downloads_path: z.string(),
    language: z.string<'es' | 'en'>(),
    client: z.object({
        name: z.string<'mangadex' | 'leercapitulo'>(),
        need_browser: z.boolean()
    }
    ),
})

const spin = ora()
export class Configuration extends EventEmitter {
    private static instace: Configuration | null = null
    private context!: Page 
    private browser: BrowserContext | null = null
    private lang!: LangInterface
    private client!: MangaServerInterface
    private config: ConfigurationInterface = {
        deepSearch: false,
        downloads_path: DOWNLOADS_DEFAULT_DIR,
        language: 'en',
        client: mangaServerRegister['leercapitulo']
    }

    private constructor() {
        super()
    }

    static async getInstance() {
        if (!this.instace) {
            this.instace = new Configuration()
            await this.instace.load()
            return this.instace
        }
        return this.instace
    }
    get configuration(){
        return this.config
    }
    async loadBrowser() {
        try {
            spin.start('loading Browser')
            this.browser = await firefox.launchPersistentContext(
                path.join(TEMP_DIR, 'tanko', 'browser'),
                LAUNCH_OPTIONS);

            spin.stop()
            await this.browser.addInitScript(() => {
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
            spin.start('Close browser...')
            await this.context.close()
            await this.browser.close()
            this.browser = null
            spin.stop()
            this.emit('close')
        } catch (e) {
            console.log(e)
        }
    }
    async load(conf: ConfigurationInterface | null = null) {
        try {

            if (fs.existsSync(CONFIG_FILE_PATH) && !conf) {
                const confJSON = (await fsPromise.readFile(CONFIG_FILE_PATH)).toString()
                this.config = await schema.parseAsync(JSON.parse(confJSON)) as ConfigurationInterface
            }
            this.lang = lang[this.config.language]

            if (this.config.client.need_browser && !this.browser) {
                await this.loadBrowser()
            }else if(!this.config.client.need_browser && this.browser){
                await this.closeBrowser()
            }

            if (
                (!this.context || !this.browser) &&
                this.config.client.need_browser
            ) throw new Error('Fatal init error')

            this.client = (mangaServerRegister[this.config.client.name].client)(this.context)
            await this.store()
            this.emit('load', this.config, this.client, this.context,this.browser)
        } catch (e) {
            console.log(e)
        }
    }
    async store() {
        try {
            await fsPromise.writeFile(
                CONFIG_FILE_PATH,
                JSON.stringify(schema.parse(this.config), null, '\t'))
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
        await this.load(conf)
        this.emit('update', this.config, this.client)
    }
}