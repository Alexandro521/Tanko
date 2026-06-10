import type { PromptObject, Choice } from "@alex_521/prompts";
import { SignalsCodes, ConfigurationOptions } from "../types/enum.js";
import chalk from "chalk";
import { PRIMARY_COLOR } from "../const.js";
import { Configuration, ConfigurationEvents } from "../functions/configuration.js";
import type {ChapterLanguage } from "../types/types.js";

const instance =  await Configuration.getInstance()
let {configuration,main_sections,chapter_access_options} = instance.getLanguageInterface()

instance.on(ConfigurationEvents.updateLanguage, async (nLang) => {
    const lang = nLang
    configuration = lang.configuration
    main_sections = lang.main_sections
    chapter_access_options = lang.chapter_access_options
})

// [General Prompts]
export const generateChapterList = (title: string,startIndex:number, choices: Choice[]): PromptObject<'chapter'> => {
    return {
        type: 'autocomplete',
        name: 'chapter',
        initial: startIndex,
        message: title,
        hint: `capitulos: ${choices.length}`,
        choices,
        clearFirst: true,
        //limit: 30
    }
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

const ChapterAccessOptions = () => {
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
    }
}
}

type SelectMode = 'autocomplete' | 'select'
const SectionPrompt = (title: string, choices: Choice[],hint = '', index:number,type: SelectMode = 'autocomplete'): PromptObject<'target'> => {
    return {
        type: type,
        name: 'target',
        hint,
        initial: index,
        message: chalk.bgHex(PRIMARY_COLOR)(` ${title} `),
        choices,
        clearFirst: true
    }
}

// [Principal Sections]
export const mainPrompt = (): PromptObject<'target'> => {
    return {
    type: 'select',
    name: 'target',
    message: chalk.bgHex(PRIMARY_COLOR)(` ${main_sections.main.title} `),
    choices: [
        { title: main_sections.search.title, value: SignalsCodes.search_section },
        { title: main_sections.popular.title, value: SignalsCodes.popular_section },
        { title: main_sections.recent.title, value: SignalsCodes.lasted_section },
        { title: main_sections.history.title, value: SignalsCodes.history_section },
        { title: main_sections.config.title, value: SignalsCodes.configuration_section },
        { title: main_sections.exit.title, value: SignalsCodes.exit },
    ]
    }
}
export const searchPrompt = (): PromptObject<'query'> =>{
    return {
        type: 'text',
        name: 'query',
        message: chalk.bgHex(PRIMARY_COLOR)(` ${main_sections.search.title} `),
    }
}

// [Sections]

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

const configurationOptions = ():Choice[] => {
    return [
    {
        title: configuration.options.client,
        value: ConfigurationOptions.Server,
    },
    /*{
        title: "Search",
        value: ConfigurationOptions.Search,
    },*/
    {
        title: configuration.options["lang-ui"], 
        value: ConfigurationOptions.language,
    },
    /* {
        title: "Downloads",
        value: ConfigurationOptions.downloads,
    },*/
    {
        title: configuration.options.save, 
        value: ConfigurationOptions.save,
    },
    {
        title: configuration.options.restore, 
        value: ConfigurationOptions.restoreDefault,
    }
]
}
export const configurationPrompt = () => SectionPrompt(main_sections.config.title, configurationOptions(), '',0, 'select')

// [ CONFIGURATION PROMPTS ]

export const serverPrompt = (hint:string, ch: Choice[]) => {
    return SectionPrompt('Server', ch, `current: ${hint}`,0, 'select')
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
    return SectionPrompt('Language', langChoice, `current: ${hint}`, index, 'select')
}


// [Chapter Options]

export const basicChapterOptions = ()=>{
    const sh = ChapterAccessOptions() 
    return  SectionPrompt('Options', [
    sh.read,
    sh.download,
    //ChapterAccessOptions.suscribe,
    sh.exit,
], '',0, 'select')
}

export const historyChapterOptions = (title: string) => {
    const sh = ChapterAccessOptions()
    return SectionPrompt('Options', [
    sh.resume_read,
    sh.getChapters,
    sh.download,
    //ChapterAccessOptions.suscribe,
    sh.exit,
], title,0, 'select')
}
export const popularMangaSelectOptions = (title: string) =>{
    const sh = ChapterAccessOptions()
    return SectionPrompt('Options', [
    sh.read,
    sh.getChapters,
    sh.download,
    //ChapterAccessOptions.suscribe,
    sh.exit,

], title,0, 'select')
}

export const terminalReaderChapterOptions = ()=>{ 
    let sh =    ChapterAccessOptions()
    return SectionPrompt('Opciones', [
        sh.prevoius_chapter,
        sh.next_chapter,
        sh.download,
        sh.getChapters,
    //ChapterAccessOptions.suscribe,
        sh.exit,
], '',0, 'select')
}

export const chapterLangChoices = (langs: ChapterLanguage[]) => {
    const choices = langs.map((e):Choice=>{
        return {
            title: e.lang,
            value: e.lang
        }
    })
    return SectionPrompt('Select Language',choices, '', 0, 'select' )
}