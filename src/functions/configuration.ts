import { mangaServerRegister, type Client } from "../servers/port.js";
import type { AvalibleLangs, LangInterface } from "../types/lang.js";
import type { ConfigurationInterface, MangaProvider, ServerName } from "../types/types.js";
import chalk from "chalk";
import fs from "fs";
import fsPromise from "fs/promises";
import ora from "ora";
import path from "path";
import { type Browser, type BrowserContext, firefox, type Page } from "playwright";
import { BROWSER_CONTEXT_OPTIONS, BROWSER_STORAGE_FILE, CONFIG_FILE_PATH, DOWNLOADS_DEFAULT_DIR, LAUNCH_OPTIONS, TEMP_DIR } from "../const.js";
import { LANGUAGE_REGISTER } from "./lang.js";
import EventEmitter from "events";
import { Notify, NotifyType } from "./notify.js";
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
const noti = Notify.getInstace()
const contextInitScript = () => {
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
}

export class Configuration extends EventEmitter {
    private static confInstance: Configuration
    private ServerHandler!: MangaProvider
    private lang!: LangInterface
    private browser: Browser | null = null
    private browserContext!: BrowserContext
    private browserPage!: Page

    private config: ConfigurationInterface = {
        isFirstRun: true,
        downloads_path: DOWNLOADS_DEFAULT_DIR,
        deepSearch: false,
        langKey: 'es',
        server: mangaServerRegister[1], // mangadex is default server
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
        }
        return this.confInstance
    }

    get configuration() {
        return this.config
    }
    async loadBrowser() {
        if (this.browser || this.browserContext) return
        try {
            spin.start(this.lang.loading_states.browser_init)
            this.browser = await firefox.launch(LAUNCH_OPTIONS);
            this.browserContext = await this.browser.newContext(BROWSER_CONTEXT_OPTIONS)
            if(fs.existsSync(BROWSER_STORAGE_FILE)){
                await this.browserContext.setStorageState(BROWSER_STORAGE_FILE)
            }
            await this.browserContext.addInitScript(contextInitScript);
            spin.stop()
            this.browserPage = this.browserContext.pages()[0] || await this.browserContext.newPage();
            this.browserPage.route('**/*', route => {
                const requestType = route.request().resourceType();
                if (requestType === 'script' && route.request().frame() !== this.browserPage.mainFrame()) {
                    return route.abort();
                }
                if (['font', 'image', 'media', 'beacon'].includes(requestType)) {
                    route.abort()
                } else {
                    route.continue()
                }
            })
            this.emit(ConfigurationEvents.browserLoaded)
        } catch (e: any) {
            if (spin.isSpinning) spin.fail()
            if (e instanceof Error) {
                noti.push({
                    title: e.name,
                    message: e.message,
                    type: NotifyType.error
                })
            }
        }
    }
    async closeBrowser() {
        try {
            if (!this.browser) return
            spin.start(this.lang.loading_states.browser_close)
            await this.browserContext.storageState({path:BROWSER_STORAGE_FILE})
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
    async setServer(newServer: Client) {
        if (!newServer.need_browser && this.browser) {
            await this.closeBrowser()
        } else if (newServer.need_browser && !this.browser) {
            await this.loadBrowser()
        }
        if ((!this.browserContext || !this.browser) && newServer.need_browser)
            throw new Error('Error on browser loading')
        this.config.server = newServer;
        this.ServerHandler = newServer.client(this.browserPage)
        this.emit(ConfigurationEvents.updateServer, this.ServerHandler)
    }
    async setLanguage(newLang: AvalibleLangs) {
        this.lang = LANGUAGE_REGISTER[newLang]
        this.emit(ConfigurationEvents.updateLanguage, this.lang)
    }
    async loadConfiguration(conf: ConfigurationInterface | null = null) {
        try {
            if (fs.existsSync(CONFIG_FILE_PATH) && !conf) {
                const confRaw = (await fsPromise.readFile(CONFIG_FILE_PATH)).toString()
                const conf = await JSON.parse(confRaw) as ConfigurationInterface
                const thisConf = this.config
                this.config = {
                    langKey: conf?.langKey ?? thisConf.langKey,
                    server: conf?.server ??  thisConf.server,
                    deepSearch: conf?.deepSearch ?? thisConf.deepSearch,
                    downloads_path: conf?.downloads_path ?? thisConf.downloads_path,
                    favoriteChapterLang: conf?.favoriteChapterLang ?? thisConf.favoriteChapterLang,
                    historyMaxSize: conf?.historyMaxSize  ?? thisConf.historyMaxSize,
                    historyServerFilter: conf?.historyServerFilter ?? thisConf.historyServerFilter,
                    imageCacheMaxSize: conf?.imageCacheMaxSize ?? thisConf.imageCacheMaxSize,
                    isFirstRun: conf?.isFirstRun ?? thisConf.isFirstRun
                }
            }
            if (this.config.langKey)
                this.lang = LANGUAGE_REGISTER[this.config.langKey]
            if (this.config.server.need_browser && !this.browser) {
                await this.loadBrowser()
            } else if (!this.config.server.need_browser && this.browser) {
                await this.closeBrowser()
            }
            if (!this.browser && this.config.server.need_browser)
                throw new Error('Error on browser loading')
            const serverTarget = mangaServerRegister.find(server => server.name === this.config.server.name)
            if (serverTarget) this.ServerHandler = serverTarget?.client(this.browserPage)
            this.emit(ConfigurationEvents.loadConfiguration, this.config, this.ServerHandler, this.browserPage, this.browserContext)
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
    async getLanguageInterface() {
        if (!this.lang)
            await this.loadConfiguration()
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
        const serverTarget = mangaServerRegister.find(server => server.name === newServerName)
        if (serverTarget) {
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