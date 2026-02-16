import type { PromptObject, Choice } from "prompts";
import { SignalsCodes } from "../types.js";


export const chapterSelect = (title: string, count: number, choices: Choice[]): PromptObject<'chapter'> => {
    return {
        type: 'select',
        name: 'chapter',
        message: title,
        hint: `capitulos: ${count}`,
        choices,
       // clearFirst: true,
        limit: 30
    }
}

// [Principal Section]

export const mainPrompt: PromptObject<'opt'> = {
    type: 'select',
    name: 'opt',
    message: 'Menu principal',
    choices: [
        { title: 'Buscar', value: SignalsCodes.search_section},
        {title:  'Populares', value: SignalsCodes.popular_section},
        {title:  'Mas Recientes', value: SignalsCodes.lasted_section},
        { title: 'historial', value: SignalsCodes.history_section},
        { title: 'configuracion', value: SignalsCodes.configuration_section },
        { title: 'salir', value: SignalsCodes.exit },
    ]
}

export const historyPrompt = (choices: Choice[]): PromptObject<'manga'> => {

    return {
        type: 'select',
        name: 'manga',
        message: 'Historial de lectura',
        choices,
       // clearFirst: true
    }
}

// [Search Section]

export const search: PromptObject<'query'> = {
    type: 'text',
    name: 'query',
    message: 'Search',
}

export const searchResultPrompt = (mangaList: Choice[], count: number): PromptObject<'manga'>=> {
    return {
        type: 'autocomplete',
        name: 'manga',
        hint: `Resultados: ${count}`,
        message: 'seleciona tu resultado',
        choices: mangaList,
    }
}

const BasicChapterOptions: Choice[] = [
    {
        title: 'Leer Capitulo',
        description: 'Se recomienda terminal kitty para esta operacion',
        value: SignalsCodes.read_chapter
    },
    {
        title: 'Descargar Capitulo',
        description: 'descargar el capitulo en formato PDF',
        value: SignalsCodes.download_chapter,
    },{
           title: 'Salir',
            value: SignalsCodes.exit
    }

] 

export const terminalReaderChapterOptions: PromptObject<'opt'> = {
    type: 'select',
    name: 'opt',
    message: 'Opciones',
    choices: [
        {
            title: 'Capitulo Anterior',
            value: SignalsCodes.previous_chapter
        },
        {
            title: 'Siguiente Capitulo',
            value: SignalsCodes.nex_chapter
        },
        BasicChapterOptions[1],
        {
            title: 'Salir',
            value: SignalsCodes.exit
        }
    ]
}

export const searchChapterSelectedOptions: PromptObject<'opt'> = {
    type: 'select',
    message: 'que quieres hacer?',
    name: 'opt',
    choices: BasicChapterOptions
}

// [History section]

export const historyCahpterSelectedOptions = (title: string): PromptObject<'opt'> => {
    return {
        type: 'select',
        name: 'opt',
        message: `Accion para ${title}`,
        choices: [
            {
                title: 'Continuar lectura',
                description: 'Se recomienda usar (Kitty, !Term) terminal para esta operacion',
                value: SignalsCodes.read_chapter
            },
            {
                title: 'Ver lista de capitulos',
                value: SignalsCodes.get_chapters_list
            },
            {
                title: 'Descargar capitulo',
                description: 'En formato PDF',
                value: SignalsCodes.download_chapter
            },
            {
                title: 'Salir',
                description: 'a la anterior seccion',
                value: SignalsCodes.download_chapter
            }
        ]
    }
}

//[Popular Section]

export const PopularMangaSelectOptions:PromptObject<'opt'> = {
    type: 'select',
    name: 'opt',
    message: 'opciones',
    choices: [
        ...BasicChapterOptions,
        {
            title: 'Ver lista de capitulos',
            value: SignalsCodes.get_chapters_list
        },
        {
            title: 'Salir',
            description: 'a la anterior seccion',
            value: SignalsCodes.exit
        }
    ]
}
export const voidPrompt: PromptObject = {
                type: 'invisible',
                name: 'exit',
                message: 'Este lugar esta vacio! \n [ESC] para volver al menu anterior'
            }