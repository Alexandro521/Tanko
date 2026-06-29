import { mangaServerRegister, type Client } from "../servers/port.js";
import type { AvalibleLangs, LangInterface } from "../types/lang.js";
import type { ConfigurationInterface, MangaProvider, ServerName, TrackerNames } from "../types/types.js";
import fs from "fs";
import fsPromise from "fs/promises";
import ora from "ora";
import { type Browser, type BrowserContext, firefox, type Page } from "playwright";
import { ConfigurationEvents } from "../types/enum.js";
import { BROWSER_CONTEXT_OPTIONS, BROWSER_STORAGE_FILE, CONFIG_FILE_PATH, DOWNLOADS_DEFAULT_DIR, LAUNCH_OPTIONS } from "../const.js";
import { LANGUAGE_REGISTER } from "./lang.js";
import EventEmitter from "events";
import { Notify, NotifyType } from "./notify.js";
import { AniList } from "../integration/anilist.js";

const LOAD_SPIN = ora()
const NOTIFY_INSTANCE = Notify.getInstace()

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
    private static singletonInstance: Configuration
    private mangaProvider!: MangaProvider
    private langInterface!: LangInterface
    private browser: Browser | null = null
    private browserContext!: BrowserContext
    private contextPage!: Page

    public settings: ConfigurationInterface = {
        isFirstRun: true,
        downloads_path: DOWNLOADS_DEFAULT_DIR,
        deepSearch: false,
        langKey: 'es',
        server: mangaServerRegister[1], // mangadex
        favoriteChapterLang: 'any',
        historyMaxSize: 256,
        historyServerFilter: true,
        imageCacheMaxSize: '64',
        login: {
            anilist: {
                integration: AniList.getInstance(),
                isAuth: false
            }
        }
        //customBrowserHandlePath: 'NULL',
    }
    private constructor() {
        super()
    }

    static async getInstance() {
        if (!this.singletonInstance) {
            this.singletonInstance = new Configuration()
            await this.singletonInstance.loadConfiguration()
        }
        return this.singletonInstance
    }
    get configuration() {  // I will delete this later
        return this.settings
    }
    async loadBrowser(): Promise<boolean> {
        try {
            if(this.isBrowserRunnig()) {
                return true
            }
            LOAD_SPIN.start(this.langInterface.loading_states.browser_init)
            let isContextExist = false
            if( typeof firefox.launch === 'function' ){
                this.browser = await firefox.launch(LAUNCH_OPTIONS);
                this.browserContext = await this.browser.newContext(BROWSER_CONTEXT_OPTIONS)
                this.browser.once('context', ()=>{
                    isContextExist = true
                })
            }else {
                throw new Error('Error on browser loadind, please check if playwright browser has installed')
            }
            if(!this.browser.isConnected()){
                this.browser = null
                throw new Error(this.langInterface.err_messages.network.msg)
            }
            if(fs.existsSync(BROWSER_STORAGE_FILE)){
                await this.browserContext.setStorageState(BROWSER_STORAGE_FILE)
            }
            await this.browserContext.addInitScript(contextInitScript);
            LOAD_SPIN.stop()
            this.contextPage = (
                this.browserContext.pages()[0] 
                ?? await this.browserContext.newPage()
            )
            this.contextPage.route('**/*', route => {
                const request = route.request()
                const contentType = request.resourceType();
                if (contentType === 'script' && route.request().frame() !== this.contextPage.mainFrame()) {
                    return route.abort();
                }
                const contentTypeRexp = new RegExp(/.+(font|image|media|beacon).+/)
                if (contentTypeRexp.test(contentType)) {
                    route.abort()
                } else {
                    route.continue()
                }
            })
            this.emit(ConfigurationEvents.browserLoaded)
            return true
        } catch (e: any) {
            if (LOAD_SPIN.isSpinning) LOAD_SPIN.stop()
            if (e instanceof Error) {
                NOTIFY_INSTANCE.push({
                    title: e.name,
                    message: e.message,
                    type: NotifyType.error
                })
            }
            return false
        }
    }
    private async testBrowserInstance(){
        try{
            if(!this.browser || !this.contextPage) return false
            const testPage = await this.browserContext.newPage()
            await testPage.goto('https://example.com/', {timeout: 5000})
            await testPage.close()
            return true
        }catch(e){
            return false
        }
    }
    private isBrowserRunnig(){
        if(this.contextPage !== null && this.browserContext !== null && this.browser !== null) {
            if(this.browser.isConnected())
                return true
            else return false
        }
        else 
            return false
    }
    async closeBrowser(): Promise<boolean> {
        try {
            if (!this.browser && !this.browserContext && !this.contextPage) return true
            LOAD_SPIN.start(this.langInterface.loading_states.browser_close)
            if(this.browserContext){
                await this.browserContext.storageState({path:BROWSER_STORAGE_FILE})
                await this.browserContext.close()
                /* Don't cry, TypeScript compiler */
                this.contextPage = null as unknown as Page
                this.browserContext = null as unknown as  BrowserContext
            }
            if(this.browser){
                await this.browser.close()
                this.browser = null
            }
            LOAD_SPIN.stop()
            this.emit(ConfigurationEvents.browserClose)
            return true
        } catch (e) {
            if (LOAD_SPIN.isSpinning) LOAD_SPIN.fail()
            console.log(e)
            return false
        }
    }
    async setServer(provider: Client) {
        try{
            if (!provider.need_browser && this.isBrowserRunnig()) {
                const isOk = await this.closeBrowser()
            if(!isOk)
                throw new Error("The browser could not be closed, please try again");
        } else if (provider.need_browser && !this.isBrowserRunnig()) {
            const isOk = await this.loadBrowser()
            if(!isOk) 
                throw new Error(this.langInterface.err_messages.client_switch.msg);
        }
        this.settings.server = {
            name: provider.name,
            need_browser: provider.need_browser
        };
        this.mangaProvider = provider.client(this.contextPage)
        this.emit(ConfigurationEvents.updateServer, this.mangaProvider)
        } catch (e) {
            if (e instanceof Error) {
                NOTIFY_INSTANCE.push({
                    title: e.name,
                    message: e.message,
                    type: NotifyType.error,
                })
            }
        }
    }
    async setLanguage(newLang: AvalibleLangs) {
        this.langInterface = LANGUAGE_REGISTER[newLang] ?? LANGUAGE_REGISTER['en']
        this.emit(ConfigurationEvents.updateLanguage, this.langInterface)
    }
    async loadConfiguration(conf: ConfigurationInterface | null = null) {
        try {
            const self = this.settings
            if (fs.existsSync(CONFIG_FILE_PATH)) {
                const settingsFile = await fsPromise.readFile(CONFIG_FILE_PATH)
                const settings = await JSON.parse( settingsFile.toString()) as ConfigurationInterface
                this.settings = {
                    langKey: settings?.langKey ?? self.langKey,
                    server: settings?.server ?? self.server,
                    deepSearch: settings?.deepSearch ?? self.deepSearch,
                    downloads_path: settings?.downloads_path ?? self.downloads_path,
                    favoriteChapterLang: settings?.favoriteChapterLang ?? self.favoriteChapterLang,
                    historyMaxSize: settings?.historyMaxSize ?? self.historyMaxSize,
                    historyServerFilter: settings?.historyServerFilter ?? self.historyServerFilter,
                    imageCacheMaxSize: settings?.imageCacheMaxSize ?? self.imageCacheMaxSize,
                    isFirstRun: settings?.isFirstRun ?? self.isFirstRun,
                    login: self.login
                }
            }
            await this.setLanguage(this.settings.langKey)
            await this.setServerByName(this.settings.server.name)
            this.emit(
                ConfigurationEvents.loadConfiguration,
                this.settings,
                this.mangaProvider,
                this.contextPage,
                this.browserContext
            )
        } catch (e) {
            if (e instanceof Error) {
                NOTIFY_INSTANCE.push({
                    title: e.name,
                    message: e.message,
                    type: NotifyType.error,
                })
            }
        }
    }
    async writeConfigFile() {
        try {
            await fsPromise.writeFile(
                CONFIG_FILE_PATH,
                JSON.stringify(this.settings, null, '\t'))
            this.emit(ConfigurationEvents.storeConfFile)
        } catch (e) {
            console.log(e)
        }
    }
    async getLanguageInterface() {
        if (!this.langInterface)
            await this.loadConfiguration()
        return this.langInterface

    }
    getBrowserContext() {
        if (this.browserContext)
            return this.browserContext
        return null
    }
    getServerInfo() {
        return this.settings.server
    }
    getServer() {
        return this.mangaProvider
    }
    async setServerByName(newServerName: ServerName) {
        const serverTarget = mangaServerRegister.find(server => server.name === newServerName) ?? mangaServerRegister[1]
        if (serverTarget) {
            await this.setServer(serverTarget)
            return this.mangaProvider
        }
    }
    async setGlobalConfig(conf: ConfigurationInterface) {
        if (conf)
            await this.loadConfiguration(conf)
        await this.writeConfigFile()
        this.emit(ConfigurationEvents.updateGlobal, this.settings, this.mangaProvider, this.langInterface)
    }
    async login(trackerName: TrackerNames | undefined = undefined){
        const trackerLogin = async (name: TrackerNames) =>{
            const tracker = this.settings.login[name].integration
            const userData = await tracker.login()
            if(userData) {
                this.settings.login[name] = {
                    isAuth: true,
                    integration: tracker,
                    data: userData
                }
                this.emit(ConfigurationEvents.login, this.settings.login[name])
            }
        }
        if(trackerName) {
            await trackerLogin(trackerName)
            return
        }
        await Promise.all(
            Object.values(this.settings.login).map(({isAuth, integration})=>{
                if(!isAuth){
                    return trackerLogin(integration.trackerName)
                }else {
                    Promise.resolve()
                }
            })
        )
        return
    }
    async logout(trackerName: TrackerNames){
        const tracker = this.settings.login[trackerName].integration
        this.settings.login[trackerName] = {
            isAuth: false,
            integration: tracker
        }
        await tracker.logout()
    }
    getLoginData(){
        return this.settings.login
    }
}