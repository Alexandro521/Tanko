import { mangaServerRegister, type Client } from "../servers/port.js";
import type { Settings, MangaProvider, ProviderConfInterface, ServerName, TrackerInterface, TrackerNames } from "../types/types.js";
import fs from "fs";
import fsPromise from "fs/promises";
import { type Browser, type BrowserContext, firefox, chromium , type Page } from "playwright";
import { BROWSER_CONTEXT_OPTIONS, BROWSER_STORAGE_FILE, CONFIG_FILE_PATH, DOWNLOADS_DEFAULT_DIR, LAUNCH_OPTIONS } from "../const.js";
import { LANGUAGE_REGISTER, type LanguageInterface, type AvalibleLanguageInterface } from "./lang.js";
import EventEmitter from "events";
import { Notify } from "./notify.js";
import { AniList } from "../trackers/anilist.js";

type ConfigurationEvents = {
    'updateprovider': [provider: MangaProvider]
    'updatelanguage': [language: LanguageInterface]
    'load': [settings: Settings]
    'updateglobal': [settings: Settings]
    'store': [settings: Settings, path: string]
    'error': [error: Error]
    'browserinit': []
    'browserclosing': []
    'browserclose': []
    'browserload': [configuration: BrowserConfiguration]
    'login': [tracker:  TrackerNames]
    'logout': [tracker:  TrackerNames]
    'atomicupdate': [change: keyof Settings]
}

export class Configuration extends EventEmitter<ConfigurationEvents> {
    private static confInstance: Configuration
    conf_language!: LanguageInterface
    conf_provider!: ProviderConfiguration
    conf_browser!:  BrowserConfiguration
    conf_session!: SessionConfiguration

    public settings: Settings = {
        tanko_isFirstRun: true,
        languageISO: 'es',
        preferedLanguageISO: 'any',
        history_maxSize: 256,
        history_filterByProvider: true,
        image_maxCacheLength: 24,
        image_maxCacheByteLength: 64 * 1024,
        search_deepSearch: false,
        provider: mangaServerRegister[1], // mangadex
        downloader_path: DOWNLOADS_DEFAULT_DIR
        //customBrowserHandlePath: 'NULL',
        ,
        reader_forceAscii: false,
        reader_forceImgProtocol: 'default',
        reader_maxImagePreloading: 5,
        reader_enableImgPreloading: true,
        reader_imgPreloadingStrategy: "around",
        reader_imgFit: "contain",
        reader_maxImgWidth: 8096
    }

    private  constructor() {
        super()
        this.conf_browser = new BrowserConfiguration(this)
        this.conf_session = new SessionConfiguration(this)
        this.conf_language = LANGUAGE_REGISTER['en']
        this.conf_provider = new ProviderConfiguration(this, this.conf_browser, this.conf_language)
    }
    static async getInstance() {
        if (!this.confInstance) {
            this.confInstance = new Configuration()
            await this.confInstance.init()
        }
        return this.confInstance
    }
    async setLanguage(newLang: AvalibleLanguageInterface) {
        this.conf_language = LANGUAGE_REGISTER[newLang] ?? LANGUAGE_REGISTER['en']
        this.conf_provider.langInterface = this.conf_language
        this.emit('updatelanguage', this.conf_language)
    }
    async init() {
        try {
            const self = this.settings
            if (fs.existsSync(CONFIG_FILE_PATH)) {
                const settingsFile = await fsPromise.readFile(CONFIG_FILE_PATH)
                const settings = await JSON.parse( settingsFile.toString()) as Settings
                this.settings = {
                    languageISO: settings?.languageISO ?? self.languageISO,
                    provider: settings?.provider ?? self.provider,
                    search_deepSearch: settings?.search_deepSearch ?? self.search_deepSearch,
                    downloader_path: settings?.downloader_path ?? self.downloader_path,
                    preferedLanguageISO: settings?.preferedLanguageISO ?? self.preferedLanguageISO,
                    history_maxSize: settings?.history_maxSize ?? self.history_maxSize,
                    history_filterByProvider: settings?.history_filterByProvider ?? self.history_filterByProvider,
                    image_maxCacheByteLength: Number(settings?.image_maxCacheByteLength) ?? self.image_maxCacheByteLength,
                    image_maxCacheLength:  settings?.image_maxCacheLength ?? self.image_maxCacheLength,
                    tanko_isFirstRun: settings?.tanko_isFirstRun ?? self.tanko_isFirstRun,
                    reader_forceAscii: settings?.reader_forceAscii ?? self.reader_forceAscii,
                    reader_forceImgProtocol: settings?.reader_forceImgProtocol ?? self.reader_forceImgProtocol,
                    reader_maxImagePreloading: settings?.reader_maxImagePreloading ?? self.reader_maxImagePreloading,
                    reader_enableImgPreloading: settings?.reader_enableImgPreloading ?? self.reader_enableImgPreloading,
                    reader_imgPreloadingStrategy: settings?.reader_imgPreloadingStrategy ?? self.reader_imgPreloadingStrategy,
                    reader_imgFit: settings?.reader_imgFit ?? self.reader_imgFit,
                    reader_maxImgWidth: settings?.reader_maxImgWidth ?? self.reader_maxImgWidth
                }
            }
            await this.setLanguage(this.settings.languageISO)
            let providerName = this.settings.provider.name
            const hasProvider = mangaServerRegister.values().some((e)=> e.name === providerName)
            await this.conf_provider.setProviderByName(hasProvider ? providerName : mangaServerRegister[0].name)
            await this.conf_session.login('anilist')
            this.emit('load', this.settings)
        } catch (e) {
            if (e instanceof Error) {
                Notify.pushError(e)
            }
        }
    }
    async store() {
        try {
            await fsPromise.writeFile( CONFIG_FILE_PATH, JSON.stringify(this.settings, null, '\t'))
            this.emit('store', this.settings, CONFIG_FILE_PATH)
        } 
        catch (err) {
            if(err instanceof Error){
                this.emit('error', err)
                Notify.pushError(err)
            }
        }
    }
    async getLanguageInterface() {
        if (!this.conf_language)
            await this.init()
        return this.conf_language
    }
    async setGlobalConfig(conf: Settings) {
        if (conf)
            await this.init()
        await this.store()
        this.emit('updateglobal', this.settings)
    }

}

class ProviderConfiguration {
    browser!: BrowserConfiguration
    settings!: ProviderConfInterface
    provider!: MangaProvider
    parent!: Configuration
    langInterface!:LanguageInterface
    constructor(parent: Configuration, browser: BrowserConfiguration, langInterface: LanguageInterface){
        this.browser = browser 
        this.settings = mangaServerRegister[0]
        this.langInterface =  langInterface
        this.parent = parent
    }
    async setServer(provider: Client) {
        try {
            const isBrowserRunning = this.browser.isRunning()
            if (!provider.need_browser && isBrowserRunning ) {
                if (!(await this.browser.close()))
                    throw new Error("The browser could not be closed, please try again");
            } else if (provider.need_browser && !isBrowserRunning) {
                if (!(await this.browser.init()))
                    throw new Error(this.langInterface.err_messages.client_switch.msg);
            }

            this.settings = {
                name: provider.name,
                need_browser: provider.need_browser
            };

            if(provider.need_browser){
                let mainPage = this.browser.getMainContextPage()
                if (!mainPage) {
                    mainPage = await this.browser.newPage()
                }
                if(mainPage)
                    this.provider = provider.client(mainPage)
                }
            else {
                //@ts-ignore
                this.provider = provider.client(undefined)
            }

            this.parent.settings.provider = this.settings
            this.parent.emit('updateprovider', this.provider)
        } catch (e) {
            if(e instanceof Error){
                this.parent.emit('error', e)
            }
        }
    }
    getSettings() {
        return this.settings
    }
    get providerInstance() {
        return this.provider
    }
    async setProviderByName(newServerName: ServerName) {
        const serverTarget = mangaServerRegister
        .find(server => server.name === newServerName) ?? mangaServerRegister[0]
        if (serverTarget) {
            await this.setServer(serverTarget)
            return this.provider
        }
    }
}
class SessionConfiguration{
    trackerInterface!: TrackerInterface
    parent!: Configuration
    constructor(parent: Configuration){
        this.trackerInterface = {
            anilist: {
                instance: AniList.getInstance(),
                isAuth: false
            }
        }
        this.parent = parent
    }
    async login(trackerName: TrackerNames | undefined = undefined){
        const trackerLogin = async (name: TrackerNames) =>{
            const tracker = this.trackerInterface[name].instance
            const userData = await tracker.auth()
            if(userData) {
                this.parent.emit('login', name)
                this.trackerInterface[name] = {
                    isAuth: true,
                    instance: tracker,
                    data: userData
                }
            }
        }
        if(trackerName) {
            await trackerLogin(trackerName)
            return   
        }
        await Promise.all(
            Object.values(this.trackerInterface).map(
                ({ isAuth, instance: integration }) => {
                if (!isAuth) {
                    return trackerLogin(integration.trackerName)
                } else {
                    Promise.resolve()
                }
            })
        )
    }
    async logout(trackerName: TrackerNames){
        const tracker = this.trackerInterface[trackerName].instance
        this.trackerInterface[trackerName] = {
            isAuth: false,
            instance: tracker
        }
        await tracker.logout()
        this.parent.emit('logout', trackerName)
    }
    getTracker(trackerName: TrackerNames){
        return this.trackerInterface[trackerName]
    }
    getLoginData(){
        return this.trackerInterface
    }
}
class BrowserConfiguration {
    browser!: Browser | null
    context!: BrowserContext | null
    mainPage!: Page | null
    parent!: Configuration

    constructor(parent: Configuration){
        this.browser = null
        this.context = null
        this.mainPage = null
        this.parent = parent
    }
    async init(): Promise<boolean> {
        return new Promise(async (resolve, reject) => {
            try {
                this.parent.emit('browserinit')
                if (this.isRunning()) {
                    return true
                }
                let hasContext = false
                const launcher = typeof firefox.launch === 'function' ? firefox : chromium
                if (typeof launcher.launch === 'function') {
                    const browser = await launcher.launch({
                        ...LAUNCH_OPTIONS,
                    });
                    const browserContext = await browser.newContext(
                        {
                            ...BROWSER_CONTEXT_OPTIONS,
                            baseURL: 'leercapitulo.org'
                        }
                    
                    )
                    this.browser = browser
                    this.context = browserContext
                    browser.once('context', () => {
                        hasContext = true
                    })
                }
                else {
                    throw new Error('Error on browser loading, please check if playwright browser has installed')
                }
                if (this.browser && !this.browser.isConnected()) {
                    throw new Error('connection refused')
                }
                const browserContext = this.context as BrowserContext
                if(!browserContext) throw new Error('Error on browser loading')
                if (fs.existsSync(BROWSER_STORAGE_FILE)) {
                    await this.context?.setStorageState(BROWSER_STORAGE_FILE)
                }
                await this.context?.addInitScript(() => {
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

                this.mainPage = (browserContext.pages())[0] ?? (await browserContext.newPage())
                this.mainPage.route('**/*', route => {
                    const request = route.request()
                    const contentType = request.resourceType();
                    if (contentType === 'script' && route.request().frame() !== (<Page>this.mainPage).mainFrame()) {
                        return route.abort();
                    }
                    const contentTypeRexp = new RegExp(/.+(font|image|media|beacon).+/)
                    if (contentTypeRexp.test(contentType)) {
                        route.abort()
                    } else {
                        route.continue()
                    }
                })
                this.parent.emit('browserload', this)
                resolve(true)
            } catch (e: any) {
                if(e instanceof Error){
                    this.parent.emit('error', e)
                    reject(e)
                }
            }
        })
    }
    async testConnection() {
        if (this.isRunning()) {
            try {
                const testPage = await ( this.context as BrowserContext ).newPage()
                await testPage.goto('https://example.com/', { timeout: 5000 })
                await testPage.close()
                return true
            } catch (e) {
                return false
            }
        }
    }
    async storageState(){
        if(this.isRunning()){
            await ( this.context as BrowserContext ).storageState({ path: BROWSER_STORAGE_FILE })
        }
    }
    async close(): Promise<boolean> {
        try {
            if (!this.isRunning()) return true
            else {
                this.parent.emit('browserclosing')
                await this.storageState()
                await this.context?.close()
                this.mainPage = null
                this.context = null
            }
            if (this.browser) {
                await this.browser.close()
                this.browser = null
            }
            this.parent.emit('browserclose')
            return true
        } catch (e) {
            if(e instanceof Error){
                this.parent.emit('error', e)
            }
            return false
        }
    }
    getContext() {
        if (this.context)
            return this.context
        return null
    }
    isRunning() {
        if (this.mainPage !== null && this.context !== null && this.browser !== null) {
        return true
        }
        else
            return false
    }
    async newPage() {
        if (this.isRunning()) {
            const page = (await this.context?.newPage())
            return page
        }

    }
    getMainContextPage () {
        return this.mainPage ?? undefined
    }
}

