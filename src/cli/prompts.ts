import type { PromptObject, Choice } from "@alex_521/prompts";
import { SignalsCodes, ConfigurationOptions, DownloadFormat, ConfigurationEvents } from "../types/enum.js";
import chalk from "chalk";
import { PRIMARY_COLOR, WELCOME_MESSAGE } from "../const.js";
import { Configuration } from "../functions/configuration.js";
import type {Chapter, ChapterLanguage, TrackerNames } from "../types/types.js";
import type { Key } from "node:readline";
import { Notify, NotifyType } from "../functions/notify.js";
import ansi from 'ansi-escapes'
import prompts from "@alex_521/prompts";
const instance =  await Configuration.getInstance()
const notify = Notify.getInstace()
let {configuration, main_sections, chapter_access_options} = await instance.getLanguageInterface()

instance.on(ConfigurationEvents.updateLanguage, async (nLang) => {
    const lang = nLang
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
function onKeyPress (this: any, key: Key, name: string): void{
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
    const optionsFactory = OptionsFactory()
    const choices = [
        optionsFactory.cfg_server,
        optionsFactory.cfg_language,
        optionsFactory.cfg_accouts,
        optionsFactory.exit
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
        $.exit,
], '',0, 'select')
}
export const chapterListPrompt = (title: string,startIndex:number, choices: Choice[]) => {
    return SectionPrompt(title, choices, `capitulos: ${choices.length}`, startIndex, 'autocomplete')
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
    const accouts =  instance.getLoginData()
    const $ = OptionsFactory()
    const choices = Object.entries(accouts).map(([name, data]): Choice =>{
        const description = data.isAuth && data.data ? chalk.dim(chalk.blueBright(data.data.name)) : 'not logged'
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