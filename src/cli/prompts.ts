import type { PromptObject, Choice } from "@alex_521/prompts";
import { SignalsCodes, ConfigurationOptions, DownloadFormat } from "../types/enum.js";
import chalk from "chalk";
import { PRIMARY_COLOR, WELCOME_MESSAGE } from "../const.js";
import { Configuration } from "../functions/configuration.js";
import type {Chapter, ChapterLanguage, TrackerNames, Settings} from "../types/types.js";
import { type Key } from "node:readline";
import { Notify } from "../functions/notify.js";
import ansi from 'ansi-escapes'
import prompts from "@alex_521/prompts";
import supportsTerminalGraphics from "supports-terminal-graphics";

const instance =  await Configuration.getInstance()
const notify = Notify.getInstace()
let {configuration, main_sections, chapter_access_options} = await instance.getLanguageInterface()

instance.on('updatelanguage', async (langInterface) => {
    const lang = langInterface
    configuration = lang.configuration
    main_sections = lang.main_sections
    chapter_access_options = lang.chapter_access_options
})

export const clearScreen = () => {
    console.log(ansi.clearViewport);
    console.log(WELCOME_MESSAGE);
};
function onRender(){
    notify.render()
}
function onKeyPress (this: any, key: Key): void{
    if(key.ctrl && key.name === 'q'){
        notify.pop()
        this.render()
    }
}
export async function askChapterLang(chapter: Chapter) {
    const avalibleLanguages = Object.values(chapter.translations); //as ChapterLangStruct[]
    let lang = avalibleLanguages[0].lang; //as default value
    if (chapter.translation_count > 1) {
        const targetLang = await prompts(chapterLangChoices(avalibleLanguages));
        if (!targetLang?.target) return null;
        lang = targetLang.target;
    }
    return lang;
}


export const voidPrompt = (message: string): PromptObject<'void'> => {
    return {
        type: 'invisible',
        name: 'void',
        message: `${message}\n  ESC  para volver al menu anterior`
    }
}
export const confirmPrompt = (message: string): PromptObject<'confirm'> => {
    return {
        type: 'confirm',
        name: 'confirm',
        message: message,  
    }
}
const OptionsFactory = () => {
    return {
        read: {
            title: chapter_access_options.read.title,
            description: chapter_access_options.read.desc,
            value: SignalsCodes.read_chapter
        },
        download: {
            title: chapter_access_options.download.title,
            description: chapter_access_options.download.desc, 
            value: SignalsCodes.download_chapter,
        },
        resume_read: {
            title: chapter_access_options.resume_read.title,
            value: SignalsCodes.resume_read,
        },
        suscribe: {
            title: chapter_access_options.suscribe.title, 
            value: SignalsCodes.suscribe_manga,
        },
        getChapters: {
            title: chapter_access_options.get_chapters.title, 
            value: SignalsCodes.get_chapters_list
        },
    exit: {
        title: chapter_access_options.exit.title,
        value: SignalsCodes.exit
    },
    prevoius_chapter: {
        title: chapter_access_options.prev_ch.title, 
        value: SignalsCodes.previous_chapter
    },
    next_chapter: {
        title: chapter_access_options.next_ch.title, 
        value: SignalsCodes.next_chapter
    },
    cfg_server: {
        title: configuration.options.client,
        value: ConfigurationOptions.Server,
    },
    cfg_search: {
        title: "Search",
        value: ConfigurationOptions.Search,
    },
    cfg_language: {
        title: configuration.options["lang-ui"], 
        value: ConfigurationOptions.language,
    },
    cfg_download: {
        title: "Downloads",
        value: ConfigurationOptions.downloads,
    },
    cfg_accouts: {
        title: configuration.options.accouts, 
        value: ConfigurationOptions.accout,
    },
    cfg_restores: {
        title: configuration.options.restore, 
        value: ConfigurationOptions.restoreDefault,
    },
    cfg_reader: {
        title: 'Reader',
        value: ConfigurationOptions.reader
    },
    cfg_history: {
        title: 'History',
        value: ConfigurationOptions.history
    },
    accout_see: {
        title: 'see profile',
        value: SignalsCodes.see_profile
    },
    accout_logout: {
        title: 'Logout',
        value: SignalsCodes.logout_accout
    }
}
}

type SelectMode = 'autocomplete' | 'select'
const SectionPrompt = (title: string, choices: Choice[],hint = '', index:number,type: SelectMode = 'autocomplete'): PromptObject<'target'> => {
    clearScreen()
    return {
        type: type,
        name: 'target',
        hint,
        initial: index,
        message: chalk.bgHex(PRIMARY_COLOR)(` ${title} `),
        choices,
        clearFirst: true,
        onKeyPress,
        onRender,
        onClose: ()=>{
          //  process.stdout.write(ansi.clearViewport)
        }
    }
}
// [Principal Sections]
export const mainPrompt = (): PromptObject<'target'> => {

    const choices: Choice[] = [
        { title: main_sections.search.title, value: SignalsCodes.search_section },
        { title: main_sections.popular.title, value: SignalsCodes.popular_section },
        { title: main_sections.recent.title, value: SignalsCodes.lasted_section },
        { title: main_sections.history.title, value: SignalsCodes.history_section },
        { title: main_sections.config.title, value: SignalsCodes.configuration_section },
        { title: main_sections.exit.title, value: SignalsCodes.exit },
    ]
    return SectionPrompt(main_sections.main.title, choices ,'', 0, 'select')
}

export const searchPrompt = (): PromptObject<'query'> =>{
    clearScreen()
    return {
        type: 'text',
        name: 'query',
        message: chalk.bgHex(PRIMARY_COLOR)(` ${main_sections.search.title} `),
    }
}
export const searchResultPrompt = (ch: Choice[], index: number) =>{
    return SectionPrompt(main_sections.search.alt, ch, `mangas: ${ch.length}`, index)
}
export const popularSectionPrompt = (ch: Choice[], index: number)=>{
    return SectionPrompt(main_sections.popular.title, ch, `mangas: ${ch.length}`, index)
}
export const lastedSectionPrompt = (ch: Choice[], index: number)=>{
    return SectionPrompt(main_sections.recent.title, ch, `mangas: ${ch.length}`, index)
}
export const historySectionPrompt = (ch: Choice[], index: number)=>{
    return SectionPrompt(main_sections.history.title, ch, `mangas: ${ch.length}`, index)
}
export const configurationPrompt = () => {
    const $ = OptionsFactory()
    const choices = [
        $.cfg_server,
        $.cfg_language,
        $.cfg_reader,
        $.cfg_history,
        $.cfg_accouts,
        $.exit
    ]
    return SectionPrompt(main_sections.config.title, choices, '',0, 'select')
}
export const serverPrompt = (hint:string, ch: Choice[]) => {
    return SectionPrompt(configuration.server_title, ch, `current: ${hint}`,0, 'select')
}
export const languagePrompt = (hint: string = 'es', index: number) => {

    const langChoice: Choice[] =   Object.entries(configuration["lang-ui"]).map((lang, index): Choice => {
        return {
            title: lang[1],
            value: {
                index: String(index),
                lang: lang[0]
            }
        }
    })
    return SectionPrompt(configuration.options["lang-ui"], langChoice, `current: ${hint}`, index, 'select')
}
export const basicChapterOptions = ()=>{
    const $ = OptionsFactory() 
    return  SectionPrompt(configuration.options_title, [
    $.read,
    $.download,
    //ChapterAccessOptions.suscribe,
    $.exit,
], '',0, 'select')
}
export const historyChapterOptions = (title: string) => {
    const $ = OptionsFactory()
    return SectionPrompt(configuration.options_title, [
    $.resume_read,
    $.getChapters,
    $.download,
    //ChapterAccessOptions.suscribe,
    $.exit,
], title,0, 'select')
}
export const popularMangaSelectOptions = (title: string) =>{
    const $ = OptionsFactory()
    return SectionPrompt(configuration.options_title, [
    $.read,
    $.getChapters,
    $.download,
    $.exit,

], title,0, 'select')
}
export const terminalReaderChapterOptions = ()=>{ 
    let $ = OptionsFactory()
    return SectionPrompt('Opciones', [
        $.prevoius_chapter,
        $.next_chapter,
        $.download,
        $.getChapters,
        $.exit,
], '',0, 'select')
}
export const chapterListPrompt = (title: string,startIndex:number, choices: Choice[], customText='') => {
    return SectionPrompt(title, choices, `capitulos: ${choices.length} ${customText}`, startIndex, 'autocomplete')
}
export const chapterLangChoices = (langs: ChapterLanguage[]) => {
    const choices = langs.map((e):Choice=>{
        return {
            title: e.lang,
            value: e.lang
        }
    })
    return SectionPrompt(configuration.select_lang_title,choices, '', 0, 'select'  )
}
export const downloadFormatOptions = () => {
    const avalibleDownloadFormats = Object.entries(DownloadFormat)
    const choices = avalibleDownloadFormats.map(([key, format]):Choice =>{
        return {
            title: key,
            value: format
        }
    })
    return SectionPrompt('Select Format', choices, '', 0, 'autocomplete')
}
export const accoutPrompt = () => {
    const accouts = instance.conf_session.getLoginData()
    const $ = OptionsFactory()
    const choices = Object.entries(accouts).map(([name, data]): Choice =>{
        const userInfo = data.data?.Viewer ?? {name: 'error', id: -1}
        const description = data.isAuth && data.data ? chalk.dim(chalk.blueBright(userInfo.name)) : 'not logged'
        return {
            title: name,
            description,
            value: data
        }
    })
    choices.push($.exit)
    return SectionPrompt(configuration.options.accouts, choices, '', 0, 'select')
}
export const accoutOptionsPrompt = (trackerName: TrackerNames, userName: string)=>{
    const $ = OptionsFactory()
    const choices = [
       // $.accout_see,
        $.accout_logout,
        $.exit
    ]
    return SectionPrompt(trackerName, choices, userName , 0, 'select')
}
export const readerConfigurationPrompt = ()=>{
    const graphicsSupport = supportsTerminalGraphics.stdout
    const graphicsProtocolsDescriptions = {
        'kitty': 'A modern, high-performance protocol that transfers image data via base64 escape sequences, supporting true color, animations, and advanced layering.',
        'iterm2': 'An inline image protocol introduced by iTerm2 that uses base64-encoded escape sequences to display images directly within the terminal window.',
        'sixel': 'A legacy bitmap graphics format originally developed by DEC that encodes images as patterns of six-pixel-high vertical blocks, supported by many terminal emulators.',
        'ascii': 'A universal fallback method that approximates visual data by translating image pixels into standard text characters of varying densities and colors.',
    }

    const avalibleProtocols = Object.keys(graphicsSupport).filter((k)=> {
        const key = k as keyof typeof graphicsSupport
        return graphicsSupport[key] === true
    })
    .map((e): Choice =>{
        return {
            title: e,
            description: graphicsProtocolsDescriptions[e as keyof typeof graphicsProtocolsDescriptions],
            value: e,
        }
    })
    avalibleProtocols.push({
        title: 'ascii',
        value: 'ascii',
        description: graphicsProtocolsDescriptions.ascii,
        },
        {
            title: 'default',
            value: 'default',
            description: 'default option',
        })
    type  PromptObj = PromptObject<'value'> 
    const prompt_graphicProtocol: PromptObj = {
        type: 'select',
        name: 'value',
        message: 'force image protocol',
        choices: avalibleProtocols
    }
    const prompt_forceAscii: PromptObj = {
        type: 'toggle',
        name: 'value',
        message: 'Force ascii mode'
    }
    const prompt_enableImgPreloading: PromptObj = {
        type: 'toggle',
        name: 'value',
        message: 'Preload pages'
    }
    const prompt_imgPreloadingPolicy: PromptObj = {
        type: 'select',
        name: 'value',
        message: 'Preloading strategy',
        choices: [
            {
                title: 'Around',
                description: 'Preload the pages surrounding the current page',
                value: 'around'
            },
            {
                title: 'Fill',
                description: 'Preload any page that has not yet loaded',
                value: 'fill'
            },
            {
                title: 'Forward',
                description: 'Preload only the page that is ahead of the current page.',
                value: 'forward'
            }
        ]
    }
    const prompt_imgFit: PromptObj = {
        type: 'select',
        name: 'value',
        message: 'Default image fit',
        choices: [
            {
                title: 'Contain',
                description: 'Scale the image to the screen size while maintaining its aspect ratio, default option',
                value: 'contain'
            }, {
                title: 'Cover',
                description: 'Scale the image to the available width, ideal for reading manhwas',
                value: 'cover'
            }
        ]
    }
    const prompt_maxImagePreloading: PromptObj = {
        type: 'number',
        name: 'value',
        message: 'Maximum preloaded pages',
        max: 24
    }
    const prompt_maxRenderWidth: PromptObj = {
        type: 'number',
        name: 'value',
        message: 'Maximum image render width',
        hint: 'When an image is scaled, its width will not exceed this value; this only applies in Cover rendering mode.',
        max: 8196
    }
    const setting = Object.fromEntries (
        Object.keys(instance.settings).map((key) => [key, key])
    ) as {[key in keyof Settings]: keyof Settings }
    const currentSettings = instance.settings
    const choices: Choice[] = [
        {
            title: prompt_graphicProtocol.message as string,
            description: currentSettings.reader_forceImgProtocol,
            value: {
                target: setting.reader_forceImgProtocol,
                prompt: prompt_graphicProtocol
            }
        },
        {
            title: prompt_forceAscii.message as string,
            description: currentSettings.reader_forceAscii ? 'enabled': 'disabled',
            value: {
                target: setting.reader_forceAscii,
                prompt: prompt_forceAscii
            }
        }, {
            title: prompt_enableImgPreloading.message as string,
            description: currentSettings.reader_enableImgPreloading ? 'enabled': 'disabled',
            value: {
                target: setting.reader_enableImgPreloading,
                prompt: prompt_enableImgPreloading
            }
        }, {
            title: prompt_imgPreloadingPolicy.message as string,
            description: currentSettings.reader_imgPreloadingStrategy,
            value: {
                target: setting.reader_imgPreloadingStrategy,
                prompt: prompt_imgPreloadingPolicy
            }
        }, {
            title: prompt_imgFit.message as string,
            description: currentSettings.reader_imgFit,
            value: {
                target: setting.reader_imgFit,
                prompt: prompt_imgFit
            }
        }, {
            title: prompt_maxImagePreloading.message as string,
            description: String(currentSettings.reader_maxImagePreloading),
            value: {
                target: setting.reader_maxImagePreloading,
                prompt: prompt_maxImagePreloading
            }
        }, {
            title: prompt_maxRenderWidth.message as string,
            description: String(currentSettings.reader_maxImgWidth),
            value: {
                target: setting.reader_maxImgWidth,
                prompt: prompt_maxRenderWidth
            }
        }, {
            title: chapter_access_options.exit.title,
            value: SignalsCodes.exit
        }
    ]
    return SectionPrompt('Reader', choices, '', 0, 'select')
}
export interface ConfigurationSettingPrompt {
    target: keyof Settings
    prompt: PromptObject<'value'>
}

export const historyConfigurationPrompt = ()=>{
    const history_filter: PromptObject = {
        type: 'toggle',
        name: 'value',
        message: 'filter by provider'
    }
    const history_size: PromptObject = {
        type: 'number',
        name: 'value',
        min: 32,
        max: 4096,
        message: 'max history size'
    }

    const choices: Choice[] = [
        {
            title: history_filter.message as string,
            description: instance.settings.history_filterByProvider ? 'enabled' : 'disabled',
            value:  {
                target: 'history_filterByProvider',
                prompt: history_filter
            } as ConfigurationSettingPrompt
        },
        {
            title: history_size.message as string,
            description: instance.settings.history_maxSize.toString(),
            value:  {
                target: 'history_maxSize',
                prompt: history_size
            } as ConfigurationSettingPrompt
        },
        {
            title: chapter_access_options.exit.title,
            value: SignalsCodes.exit
        }
    ]
    return SectionPrompt('History', choices, '', 0, 'select')
}
