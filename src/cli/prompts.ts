import type { PromptObject, Choice } from "@alex_521/prompts";
import { SignalsCodes, ConfigurationOptions, DownloadFormat } from "../types/enum.ts";
import chalk from "chalk";
import { PRIMARY_COLOR, WELCOME_MESSAGE } from "../const.ts";
import { Configuration } from "../functions/configuration.ts";
import type { Chapter, TrackerNames, Settings, MangaInfo } from "../types/types.ts";
import { type Key } from "node:readline";
import { Notify } from "../functions/notify.ts";
import ansi from 'ansi-escapes'
import prompts from "@alex_521/prompts";
import supportsTerminalGraphics from "supports-terminal-graphics";
import { LANGUAGE_REGISTER, type LangIso } from "../functions/lang.ts";
import { fuzzyMatch } from "../utils.ts";
import { UserLists } from "../functions/userlists.ts";
import sanitize from "sanitize-filename";
import type { UserlistsTable } from "../types/database.js";

const instance = await Configuration.getInstance()
const notify = Notify.getInstace()
let { configuration,generics_words, main_sections, chapter_access_options } = await instance.getLanguageInterface()

instance.on('updatelanguage', async (langInterface) => {
    const lang = langInterface
    configuration = lang.configuration
    main_sections = lang.main_sections
    chapter_access_options = lang.chapter_access_options
    generics_words = lang.generics_words
})

export const clearScreen = () => {
    process.stdout.write(ansi.cursorTo(0,0) + '\x1b[0J')
    process.stdout.write(WELCOME_MESSAGE);
};
function onRender() {
    process.stdout.write('\x1B[0J' + ansi.cursorSavePosition)
    notify.render()
    process.stdout.write(ansi.cursorRestorePosition)
}
function onKeyPress(this: any, key: Key): void {
    if (key.ctrl && key.name === 'q') {
        notify.pop()
        this.render()
    }
}
export async function askChapterLang(chapter: Chapter) {
    const avalibleTranslations = Object.keys(chapter.translations); //as ChapterLangStruct[]
    let lang = null
    if (chapter.translation_count === 1) {
        return avalibleTranslations[0]
    } else {
        const choices = avalibleTranslations.map((key): Choice => {
            const literalString = configuration.lang_iso[key as LangIso] ?? key
            return {
                title: literalString,
                value: key
            }
        })
        const sectionPrompt = SectionPrompt(configuration.select_lang_title, choices, '', 0, 'select')
        const targetLang = await prompts(sectionPrompt);
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
export const confirmPrompt = async (message: string) => {
  const opt = await prompts({
        type: 'confirm',
        name: 'confirm',
        message: message,
    } 
  )
  if (!opt.confirm) return false;
  return true
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
            title: configuration.options.lang_ui,
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
            title: configuration.options.reader,
            value: ConfigurationOptions.reader
        },
        cfg_history: {
            title: configuration.options.history,
            value: ConfigurationOptions.history
        },
        accout_see: {
            title: configuration.accouts.profile,
            value: SignalsCodes.see_profile
        },
        accout_logout: {
            title: configuration.accouts.logout,
            value: SignalsCodes.logout_accout
        },
        //TODO: i18n
        list_add: {
            title: 'add to list',
            value: SignalsCodes.list_add
        },
        list_remove: {
            title: 'remove from the list',
            value: SignalsCodes.list_remove
        },
        list_sync: {
            title: 'Sync',
            description: 'Synchronize the list with anillist',
            value: SignalsCodes.list_sync
        },
        list_delete: {
            title: 'Delete',
            value: SignalsCodes.list_delete,
            description: 'Delete this list'
        },
        list_create: {
            title: 'create a list',
            value: SignalsCodes.list_create
        },
        list_conf: {
            title: 'list settings',
            value: SignalsCodes.list_conf
        },
        list_create_name: {
            title: 'Name',
            value: SignalsCodes.list_create_name
        },
        list_create_visibility: {
            title: 'Visibility',
            value: SignalsCodes.list_create_visibility
        },
        cancel: {
            title: 'Cancel',
            value: SignalsCodes.exit
        }
    }
}

type SelectMode = 'autocomplete' | 'select'
const SectionPrompt = (title: string, choices: Choice[], hint = '', index: number, type: SelectMode = 'autocomplete'): PromptObject<'target'> => {
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
        async suggest(input: string, choices) {
            const filter: { index: number, factor: number }[] = []
            choices.forEach((choice, index) => {
                const title = choice.title
                if (input.length > 0) {
                    const hasProbability = fuzzyMatch(input, title)
                    if (hasProbability >= 75) {
                        filter.push({
                            factor: hasProbability,
                            index: index
                        })

                    }
                }
                else {
                    filter.push({
                        factor: 0,
                        index: index
                    })
                }
            })
            return filter.sort((a, b) => b.factor - a.factor).map((e) => choices[e.index])
        },
        onClose: () => {
            //  process.stdout.write(ansi.clearViewport)
        }

    }
}
// [Principal Sections]
export const mainPrompt = (): PromptObject<'target'> => {
    //TODO: i18n
    const choices: Choice[] = [
        { title: main_sections.search.title, value: SignalsCodes.search_section },
        { title: main_sections.popular.title, value: SignalsCodes.popular_section },
        { title: main_sections.recent.title, value: SignalsCodes.lasted_section },
        { title: main_sections.history.title, value: SignalsCodes.history_section },
        { title: 'My lists', value: SignalsCodes.user_list_section },
        { title: main_sections.config.title, value: SignalsCodes.configuration_section },
        { title: main_sections.exit.title, value: SignalsCodes.exit },
    ]
    return SectionPrompt(main_sections.main.title, choices, '', 0, 'select')
}

export const searchPrompt = (): PromptObject<'query'> => {
    clearScreen()
    return {
        type: 'text',
        name: 'query',
        message: chalk.bgHex(PRIMARY_COLOR)(` ${main_sections.search.title} `),
    }
}
export const searchResultPrompt = (ch: Choice[], index: number) => {
    return SectionPrompt(main_sections.search.alt, ch, `mangas: ${ch.length}`, index)
}
export const popularSectionPrompt = (ch: Choice[], index: number) => {
    return SectionPrompt(main_sections.popular.title, ch, `mangas: ${ch.length}`, index)
}
export const lastedSectionPrompt = (ch: Choice[], index: number) => {
    return SectionPrompt(main_sections.recent.title, ch, `mangas: ${ch.length}`, index)
}
export const historySectionPrompt = (ch: Choice[], index: number) => {
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
    return SectionPrompt(main_sections.config.title, choices, '', 0, 'select')
}
export const serverPrompt = (hint: string, ch: Choice[]) => {
    return SectionPrompt(configuration.server_title, ch, `current: ${hint}`, 0, 'select')
}
export const languagePrompt = (hint: string = 'es', index: number) => {
    const avalibleLanguages = Object.keys(LANGUAGE_REGISTER)
    // const currentLang = instance.getLanguageInterface()
    const isoDictionary = configuration.lang_iso
    const langChoice: Choice[] = avalibleLanguages.map((iso, index): Choice => {
        const isoStr = iso as keyof typeof isoDictionary
        const literalIso = isoDictionary[isoStr]
        return {
            title: literalIso,
            value: {
                index: String(index),
                lang: iso
            }
        }
    })
    return SectionPrompt(configuration.options["lang_ui"], langChoice, `current: ${hint}`, index, 'select')
}
export const basicChapterOptions = () => {
    const $ = OptionsFactory()
    return SectionPrompt(configuration.options_title, [
        $.read,
        $.download,
        $.list_add,
        //ChapterAccessOptions.suscribe,
        $.exit,
    ], '', 0, 'select')
}
export const historyOptionsPropmts = (title: string) => {
    const $ = OptionsFactory()
    return SectionPrompt(configuration.options_title, [
        $.resume_read,
        $.getChapters,
        $.list_add,
        $.download,
        //ChapterAccessOptions.suscribe,
        $.exit,
    ], title, 0, 'select')
}
export const popularMangaSelectOptions = (title: string) => {
    const $ = OptionsFactory()
    return SectionPrompt(configuration.options_title, [
        $.read,
    //    $.getChapters,
        $.list_add,
        $.download,
        $.exit,

    ], title, 0, 'select')
}
export const listRecordSelectOptions = (title: string) => {
    const $ = OptionsFactory()
    return SectionPrompt(configuration.options_title, [
        $.resume_read,
        $.getChapters,
        $.list_add,
        $.list_remove,
        $.exit,
    ], title, 0, 'select')
}
export const terminalReaderChapterOptions = () => {
    let $ = OptionsFactory()
    return SectionPrompt('Opciones', [
        $.prevoius_chapter,
        $.next_chapter,
        $.download,
        $.getChapters,
        $.list_add,
        $.exit,
    ], '', 0, 'select')
}
export const chapterListPrompt = (title: string, startIndex: number, choices: Choice[], customText = '') => {
    return SectionPrompt(title, choices, `${generics_words.chapters}: ${choices.length} ${customText}`, startIndex, 'autocomplete')
}
export const downloadFormatOptions = () => {
    const avalibleDownloadFormats = Object.entries(DownloadFormat)
    const choices = avalibleDownloadFormats.map(([key, format]): Choice => {
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
    const choices = Object.entries(accouts).map(([name, data]): Choice => {
        const userInfo = data.data?.Viewer ?? { name: 'error', id: -1 }
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
export const accoutOptionsPrompt = (trackerName: TrackerNames, userName: string) => {
    const $ = OptionsFactory()
    const choices = [
        // $.accout_see,
        $.accout_logout,
        $.exit
    ]
    return SectionPrompt(trackerName, choices, userName, 0, 'select')
}
export const readerConfigurationPrompt = () => {
    const { img_protocols, page_fit, page_preloading_strategy, reader } = configuration
    const graphicsSupport = supportsTerminalGraphics.stdout


    const avalibleProtocols = Object.keys(graphicsSupport).filter((k) => {
        const key = k as keyof typeof graphicsSupport
        return graphicsSupport[key] === true
    })
        .map((e): Choice => {
            const key = e as keyof typeof img_protocols
            return {
                title: img_protocols[key].name,
                description: img_protocols[key].description,
                value: e,
            }
        })
    avalibleProtocols.push({
        title: img_protocols.ascii.name,
        value: 'ascii',
        description: img_protocols.ascii.description,
    },
        {
            title: 'Default',
            value: 'default'
        })

    type PromptObj = PromptObject<'value'>
    const prompt_graphicProtocol: PromptObj = {
        type: 'select',
        name: 'value',
        message: reader.graphic_protocol,
        choices: avalibleProtocols
    }
    const prompt_forceAscii: PromptObj = {
        type: 'toggle',
        name: 'value',
        message: reader.force_ascii
    }
    const prompt_enableImgPreloading: PromptObj = {
        type: 'toggle',
        name: 'value',
        message: reader.page_preloading
    }
    const prompt_imgPreloadingPolicy: PromptObj = {
        type: 'select',
        name: 'value',
        message: reader.page_preloading_strategy,
        choices: [
            {
                title: page_preloading_strategy.around.title,
                description: page_preloading_strategy.around.description,
                value: 'around'
            },
            {
                title: page_preloading_strategy.fill.title,
                description: page_preloading_strategy.fill.description,
                value: 'fill'
            },
            {
                title: page_preloading_strategy.forward.title,
                description: page_preloading_strategy.forward.description,
                value: 'forward'
            }
        ]
    }
    const prompt_imgFit: PromptObj = {
        type: 'select',
        name: 'value',
        message: reader.page_fit,
        choices: [
            {
                title: page_fit.contain.title,
                description: page_fit.contain.description,
                value: 'contain'
            }, {
                title: page_fit.fit.title,
                description: page_fit.fit.description,
                value: 'cover'
            }
        ]
    }
    const prompt_maxImagePreloading: PromptObj = {
        type: 'number',
        name: 'value',
        message: reader.page_max_preloading,
        max: 24
    }
    const prompt_maxRenderWidth: PromptObj = {
        type: 'number',
        name: 'value',
        message: reader.page_render_max_width,
        hint: 'When an image is scaled, its width will not exceed this value; this only applies in Cover rendering mode.',
        max: 8196
    }
    const setting = Object.fromEntries(
        Object.keys(instance.settings).map((key) => [key, key])
    ) as { [key in keyof Settings]: keyof Settings }
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
            description: currentSettings.reader_forceAscii ? 'enabled' : 'disabled',
            value: {
                target: setting.reader_forceAscii,
                prompt: prompt_forceAscii
            }
        }, {
            title: prompt_enableImgPreloading.message as string,
            description: currentSettings.reader_enableImgPreloading ? 'enabled' : 'disabled',
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
    return SectionPrompt(configuration.options.reader, choices, '', 0, 'select')
}
export interface ConfigurationSettingPrompt {
    target: keyof Settings
    prompt: PromptObject<'value'>
}

export const UserListPropmt = () => {
    const lists = UserLists.getAllUserList()
    const choices = lists.map((e): Choice =>({
        title: e.name,
        value: e
    }))
    choices.push({
        title: chalk.magenta('> Create a list'),
        value: SignalsCodes.list_create
    })
    if(choices.length > 1){
        const temp = choices[0]
        choices[0] = choices[choices.length-1]
        choices[choices.length-1] = temp
    }
    return SectionPrompt('My lists', choices, '', 0, 'select')
}

export const UserListEntriesPrompt = (list: UserlistsTable) => {
    const entries = UserLists.getUserListEntries(list.id)
    const choices = entries.map((e): Choice =>({
        title: e.title,
        description: e.alias,
        value: e
    }))
    choices.push({
        title: chalk.magenta('> Edit List'),
        value: SignalsCodes.list_conf
    })
    if(choices.length > 1){
        const temp = choices[0]
        choices[0] = choices[choices.length-1]
        choices[choices.length-1] = temp
    }
    return SectionPrompt(`My lists > ${list.name}`, choices, '', 0, 'select')
}
export const addToUserListPrompt = async (mangainfo: MangaInfo) => {
    while(true){
        const listTarget = await prompts(UserListPropmt());
        if(!listTarget.target || listTarget.target === SignalsCodes.exit){
            break
        }
        if(listTarget.target === SignalsCodes.list_create){
            await createUserListPropmt()
            continue;
        }
        const listData = <UserlistsTable> listTarget.target 
        if(!UserLists.has(listData.id, mangainfo.src)){
            UserLists.addToList(listData.id, mangainfo)
            Notify.pushMessage(`${mangainfo.title} added to list ${listData.name}`,'', 'event')
        }else{
            Notify.pushMessage('this entry already exists', listData.name, 'error')
        }
    }
}

const userListNamePrompt = async () => {
  let listName = ''
  let userLists = UserLists.getAllUserList()
  while(true){
      clearScreen()
      const askName = await prompts<'name'>({
          type: 'text',
          hint: 'enter the list name',
          message: 'list name',
          name: 'name',
          clearFirst: true,
          onKeyPress,
          onRender,
      })
      if(!askName.name) break
      const safeName = sanitize(askName.name).replaceAll('\'', '')
      if(safeName.length < 3){
          Notify.pushMessage('The list name must have a minimum of 3 letters and not contain special characters.')
          continue;
      }
      const exists = userLists.findIndex((e)=> e.name === safeName)
      if(exists > -1){
          Notify.pushMessage('A list with the same name already exists.')
          continue;
      }else{
          listName = safeName
          break
      }
  }
  return listName
}
export const togglePrompt = async (msg: string, opts: [string, string], initial: boolean) => {
  const opt = await prompts({
    type: 'toggle',
    name: 'target',
    message: msg,
    active: opts[1],
    inactive: opts[0],
    initial: initial,
    onKeyPress,
    onRender
  })
  if (opt.target === undefined) {
    return undefined
  }
  return {
    label: opt.target ? opts[1] : opts[0],
    value: opt.target
  }
}
export const createUserListPropmt = async () => {
    let visibility: 'public' | 'private' = 'public'
    let listName = await userListNamePrompt()
    if (listName.length < 2) return;
    while(true){
        const opt = await prompts<'visibility'>({
            type: 'toggle',
            name: 'visibility',
            active: 'public',
            inactive: 'private',
            message: 'Visibility',
            onKeyPress,
            onRender,
        })
        if(opt.visibility !== undefined){
            visibility = opt.visibility ? 'public' : 'private'
        }
        break
    }
    UserLists.createList(listName, visibility)
}

export const historyConfigurationPrompt = () => {
    const { history } = configuration
    const history_filter: PromptObject = {
        type: 'toggle',
        name: 'value',
        initial: instance.settings.history_filterByProvider,
        message: history.history_filter
    }
    const history_size: PromptObject = {
        type: 'number',
        name: 'value',
        min: 32,
        max: 4096,
        initial: instance.settings.history_maxSize,
        message: history.history_size
    }
    //TODO: i18n
    const history_groupByManga: PromptObject = {
        type: 'toggle',
        name: 'value',
        initial: instance.settings.history_groupByManga,
        message: 'Group reading history by manga'
    }
    const choices: Choice[] = [
        {
            title: history_filter.message as string,
            description: instance.settings.history_filterByProvider ? 'enabled' : 'disabled',
            value: {
                target: 'history_filterByProvider',
                prompt: history_filter
            } as ConfigurationSettingPrompt
        },
        {
            title: history_size.message as string,
            description: instance.settings.history_maxSize.toString(),
            value: {
                target: 'history_maxSize',
                prompt: history_size
            } as ConfigurationSettingPrompt
        },
        {
            title: history_groupByManga.message as string,
            description: instance.settings.history_groupByManga ? 'enabled' : 'disabled',
            value: {
                target: 'history_groupByManga',
                prompt: history_groupByManga
            } as ConfigurationSettingPrompt
        },
        {
            title: chapter_access_options.exit.title,
            value: SignalsCodes.exit
        }
    ]
    return SectionPrompt(main_sections.history.title, choices, '', 0, 'select')
}

export const UserlistConfigPrompt = async (list: UserlistsTable) => {
  const choices: Choice[] = [
    {
      title: 'Name',
      value: SignalsCodes.list_create_name,
      description: 'Update the list name'
    },
    {
      title: 'Visibility',
      value: SignalsCodes.list_create_visibility,
      description: list.visibility ? 'public' : 'private'
    },
    {
      title: 'Sync',
      value: SignalsCodes.list_sync,
      description: 'Synchronize the list with anillist'
    },
    {
      title: 'Delete',
      value: SignalsCodes.list_delete,
      description: 'Delete this list'
    },
    {
      title: 'Exit',
      value: SignalsCodes.exit
    }
    ]
  let loop = true
  while (loop) {
    const options = await prompts(SectionPrompt(`My lists > ${list.name} > settings`, choices, 'Options', 0, 'select'))
    if (!options.target) {
      break;
    }
    switch (options.target) {
      case SignalsCodes.list_create_name: {
        const newListName = await userListNamePrompt()
        if (newListName.length > 2) {
          UserLists.updateUserList(list.id, newListName, list.visibility)
          Notify.pushMessage(`The ${list.name} list has been renamed to ${newListName}`, '', 'event')
          list.name = newListName
        }
        break
      }
      case SignalsCodes.list_create_visibility: {
        const visibility = await togglePrompt('List visibility', ['private', 'public'], list.visibility === 'public')
        if(visibility){
            //@ts-ignore
            UserLists.updateUserList(list.id, list.name, visibility.label)
            //@ts-ignore
            list.visibility = visibility.label
            choices[1].description = visibility.label
            Notify.pushMessage(`The visibility of list  ${list.name} has changed to ${visibility.label}`, '', 'event')
        }
        break
      }
      case SignalsCodes.list_delete: {
        const confirmation = await confirmPrompt('Are you sure? This is an irreversible action!')
        if(confirmation){
            UserLists.deleteList(list.id)
            Notify.pushMessage(`the list ${list.name} has been deleted`)
            loop = false;
        }
        break
      }
    }
  }
}