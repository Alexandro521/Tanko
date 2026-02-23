import type { PromptObject, Choice } from "@alex_521/prompts";
import { SignalsCodes, ConfigurationOptions } from "../types/enum.js";
import chalk from "chalk";
import { PRIMARY_COLOR } from "../const.js";


// [General Prompts]
export const generateChapterList = (title: string, count: number, choices: Choice[]): PromptObject<'chapter'> => {
    return {
        type: 'autocomplete',
        name: 'chapter',
        message: title,
        hint: `capitulos: ${count}`,
        choices,
        clearFirst: true,
        limit: 30
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

const ChapterAccessOptions = {
    read: {
        title: 'Leer Capitulo',
        description: 'Se recomienda terminal kitty para esta operacion',
        value: SignalsCodes.read_chapter
    },
    download: {
        title: 'Descargar Capitulo',
        description: 'descargar el capitulo en formato PDF',
        value: SignalsCodes.download_chapter,
    },
    resume_read: {
        title: 'Continuar lectura',
        value: SignalsCodes.resume_read,
    },
    suscribe: {
        title: 'Agregar a favoritos',
        value: SignalsCodes.suscribe_manga,
    },
    getChapters: {
        title: 'Ver lista de capitulos',
        value: SignalsCodes.get_chapters_list
    },
    exit: {
        title: 'Salir',
        value: SignalsCodes.exit
    },
    prevoius_chapter: {
        title: 'Capitulo Anterior',
        value: SignalsCodes.previous_chapter
    },
    next_chapter: {
        title: 'Siguiente Capitulo',
        value: SignalsCodes.nex_chapter
    }
}

type SelectMode = 'autocomplete' | 'select'
const SectionPrompt = (title: string, choices: Choice[],hint = '', type: SelectMode = 'autocomplete'): PromptObject<'target'> => {
    return {
        type: type,
        name: 'target',
        hint,
        message: chalk.bgHex(PRIMARY_COLOR)(` ${title} `),
        choices,
        clearFirst: true
    }
}

// [Principal Sections]
export const mainPrompt: PromptObject<'target'> = {
    type: 'select',
    name: 'target',
    message: chalk.bgHex(PRIMARY_COLOR)(' Menu principal '),
    choices: [
        { title: 'Buscar', value: SignalsCodes.search_section },
        { title: 'Populares', value: SignalsCodes.popular_section },
        { title: 'Mas Recientes', value: SignalsCodes.lasted_section },
        { title: 'historial', value: SignalsCodes.history_section },
        { title: 'configuracion', value: SignalsCodes.configuration_section },
        { title: 'salir', value: SignalsCodes.exit },
    ]
}
export const searchPrompt: PromptObject<'query'> = {
    type: 'text',
    name: 'query',
    message: chalk.bgHex(PRIMARY_COLOR)(' Busqueda '),
}

// [Sections]

export const searchResultPrompt = (ch: Choice[])=>{
    return SectionPrompt('Resultados', ch, `resultados: ${ch.length}`)
}

export const popularSectionPrompt = (ch: Choice[])=>{
    return SectionPrompt('Populares', ch, `mangas: ${ch.length}`)
}

export const lastedSectionPrompt = (ch: Choice[])=>{
    return SectionPrompt('Recientes', ch, `mangas: ${ch.length}`)
}

export const historySectionPrompt = (ch: Choice[])=>{
    return SectionPrompt('Historial', ch, `mangas: ${ch.length}`)
}

const configurationOptions: Choice[] =  [
    /* {
        title: "Server",
        value: ConfigurationOptions.Server,
    },*/
    /*{
        title: "Search",
        value: ConfigurationOptions.Search,
    },*/
    {
        title: "Language",
        value: ConfigurationOptions.language,
    },
    /* {
        title: "Downloads",
        value: ConfigurationOptions.downloads,
    },*/
    {
        title: "Save",
        value: ConfigurationOptions.save,
    },
    {
        title: "Restore Default",
        value: ConfigurationOptions.restoreDefault,
    }
]

export const configurationPrompt = SectionPrompt('Configuracion', configurationOptions, '', 'select')

// [ CONFIGURATION PROMPTS ]

export const serverPrompt = (hint:string, ch: Choice[]) => {
    return SectionPrompt('Server', ch, `current: ${hint}`, 'select')
}
const lang: Choice[] = [
    { title: "🇪🇸 Spanish", value: "es" },
    { title: "🇺🇸 English", value: "en" },]
export const languagePrompt = (hint?: string) => SectionPrompt('Language', lang, `current: ${hint ?? 'es'}`, 'select')


// [Chapter Options]

export const basicChapterOptions = SectionPrompt('Opciones', [
    ChapterAccessOptions.read,
    ChapterAccessOptions.download,
    //ChapterAccessOptions.suscribe,
    ChapterAccessOptions.exit,
], '', 'select')

export const historyChapterOptions = (title: string) => SectionPrompt('Opciones', [
    ChapterAccessOptions.resume_read,
    ChapterAccessOptions.getChapters,
    ChapterAccessOptions.download,
    //ChapterAccessOptions.suscribe,
    ChapterAccessOptions.exit,
], title, 'select')

export const popularMangaSelectOptions = (title: string) => SectionPrompt('Opciones', [
    ChapterAccessOptions.read,
    ChapterAccessOptions.getChapters,
    ChapterAccessOptions.download,
    //ChapterAccessOptions.suscribe,
    ChapterAccessOptions.exit,
], title, 'select')

export const terminalReaderChapterOptions = SectionPrompt('Opciones', [
    ChapterAccessOptions.prevoius_chapter,
    ChapterAccessOptions.next_chapter,
    ChapterAccessOptions.download,
    ChapterAccessOptions.getChapters,
    //ChapterAccessOptions.suscribe,
    ChapterAccessOptions.exit,
], '', 'select')
