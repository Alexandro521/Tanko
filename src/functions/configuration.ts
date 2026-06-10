import { mangaServerRegister, type Client } from "../clients/port.js";
import type { AvalibleLangs, LangInterface } from "../types/lang.js";
import type { ConfigurationInterface, MangaProvider, ServerName } from "../types/types.js";
import chalk from "chalk";
import fs from "fs";
import fsPromise from "fs/promises";
import ora from "ora";
import path from "path";
import { type BrowserContext, firefox, type Page } from "playwright";
import { CONFIG_FILE_PATH, DOWNLOADS_DEFAULT_DIR, LAUNCH_OPTIONS, TEMP_DIR } from "../const.js";
import { LANGUAGE_REGISTER } from "./lang.js";
import EventEmitter from "events";
const spin = ora()

export enum ConfigurationEvents {
    updateServer = 'updateserver',
    updateLanguage = 'updateLang',
    loadConfiguration = 'loadConf',
    updateGlobal = 'updateGlobal',
    storeConfFile = 'storeFile',
    failedLoad = 'failLoading',
    browserClose = 'browserClose',
    browserLoaded = 'browserOpen'
}
export class Configuration extends EventEmitter {
    private static confInstance: Configuration
    private browser: BrowserContext | null = null
    private ServerHandler!: MangaProvider
    private lang!: LangInterface
    private browserContext!: Page

    private config: ConfigurationInterface = {
        downloads_path: DOWNLOADS_DEFAULT_DIR,
        deepSearch: false,
        langKey: 'es',
        server: mangaServerRegister[0],
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
            await this.confInstance.loadConfiguration()
            return this.confInstance
        }
        return this.confInstance
    }

    get configuration() {
        return this.config
    }
    async loadBrowser() {
        try {
            spin.start(this.lang.loading_states.browser_init)
            this.browser = await firefox.launchPersistentContext(path.join(TEMP_DIR, 'tanko', 'browser'), LAUNCH_OPTIONS);
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
            this.browserContext = this.browser.pages()[0] || await this.browser.newPage();
            this.browserContext.route('**/*', route => {
                const requestType = route.request().resourceType();
                if (requestType === 'script' && route.request().frame() !== this.browserContext.mainFrame()) {
                    return route.abort();
                }
                //block unnecessary resources to speed up loading times
                if (['font', 'image', 'media', 'beacon'].includes(requestType)) {
                    route.abort()
                } else {
                    route.continue()
                }
            })
            this.emit(ConfigurationEvents.browserLoaded)
        } catch (e: any) {
            if(spin.isSpinning) spin.fail()
            if (e instanceof Error) {
                spin.fail(chalk.redBright('Error: El navegador Firefox Playwright no esta instalado'))
                console.log(chalk.yellowBright('para instalar el navegador por favor ejecute: '), chalk.gray('npx playwright install firefox'))
            }
        }
    }
    async closeBrowser() {
        try {
            if (!this.browser) return
            spin.start(this.lang.loading_states.browser_close)
            await this.browserContext.close()
            await this.browser.close()
            spin.stop()
            this.browser = null
            this.emit(ConfigurationEvents.browserClose)
        } catch (e) {
            if (spin.isSpinning) spin.fail()
            console.log(e)
        }
    }
    async setServer(newServer: Client){
        if(!newServer.need_browser && this.browser) {
            await this.closeBrowser()
        } else if (newServer.need_browser && !this.browser) {
            await this.loadBrowser()
        }
        if ((!this.browserContext || !this.browser) && newServer.need_browser)
            throw new Error('Error on browser loading')
        this.config.server = newServer;
        this.ServerHandler = newServer.client(this.browserContext)
        this.emit(ConfigurationEvents.updateServer, this.ServerHandler)
    }
    async setLanguage(newLang: AvalibleLangs){
        this.lang = LANGUAGE_REGISTER[newLang]
        this.emit(ConfigurationEvents.updateLanguage, this.lang)
    }
    async loadConfiguration(conf: ConfigurationInterface | null = null) {
        try {
            if (fs.existsSync(CONFIG_FILE_PATH) && !conf) {
                const confRaw = (await fsPromise.readFile(CONFIG_FILE_PATH)).toString()
                this.config = await JSON.parse(confRaw) as ConfigurationInterface
                console.log(JSON.stringify(this.config, null, '\t'))
            }
            if (this.config.langKey)
                this.lang = LANGUAGE_REGISTER[this.config.langKey]
            if (this.config.server.need_browser && !this.browser) {
                await this.loadBrowser()
            } else if (!this.config.server.need_browser && this.browser) {
                await this.closeBrowser()
            }
            if ((!this.browserContext || !this.browser) &&
                this.config.server.need_browser
            ) throw new Error('Error on browser loading')
            const serverTarget = mangaServerRegister.find(server=> server.name === this.config.server.name)
            if(serverTarget) this.ServerHandler = serverTarget?.client(this.browserContext)
            this.emit(ConfigurationEvents.loadConfiguration, this.config, this.ServerHandler, this.browserContext, this.browser)
        } catch (e) {
            console.log(e)
        }
    }
    async writeConfigFile() {
        try {
            await fsPromise.writeFile(
                CONFIG_FILE_PATH,
                JSON.stringify(this.config, null, '\t'))
            this.emit(ConfigurationEvents.storeConfFile)
        } catch (e) {
            console.log(e)
        }
    }
    getLanguageInterface() {
        return this.lang
    }
    getBrowserContext() {
        if (this.browserContext)
            return this.browserContext
        return null
    }
    getServerInfo() {
        return this.config.server
    }
    getServer() {
        return this.ServerHandler
    }
    async setServerByName(newServerName: ServerName) {
        const serverTarget = mangaServerRegister.find(server=> server.name === newServerName)
        if(serverTarget){
            await this.setServer(serverTarget)
            return this.ServerHandler
        }
    }
    async setGlobalConfig(conf: ConfigurationInterface) {
        if (conf)
            await this.loadConfiguration(conf)
        await this.writeConfigFile()
        this.emit(ConfigurationEvents.updateGlobal, this.config, this.ServerHandler, this.lang)
    }
}