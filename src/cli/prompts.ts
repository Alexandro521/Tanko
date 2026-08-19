import type { PromptObject, Choice } from "@alex_521/prompts";
import { SignalsCodes, ConfigurationOptions, DownloadFormat } from "../types/enum.js";
import chalk from "chalk";
import { PRIMARY_COLOR, WELCOME_MESSAGE } from "../const.js";
import { Configuration } from "../functions/configuration.js";
import type { Chapter, ChapterLanguage, TrackerNames, Settings, Translations } from "../types/types.js";
import { type Key } from "node:readline";
import { Notify } from "../functions/notify.js";
import ansi from 'ansi-escapes'
import prompts from "@alex_521/prompts";
import supportsTerminalGraphics from "supports-terminal-graphics";
import { LANGUAGE_REGISTER, type LangIso } from "../functions/lang.ts";
import { fuzzyMatch } from "../utils.ts";

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
    console.log(ansi.clearViewport);
    console.log(WELCOME_MESSAGE);
};
function onRender() {
    notify.render()
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

    const choices: Choice[] = [
        { title: main_sections.search.title, value: SignalsCodes.search_section },
        { title: main_sections.popular.title, value: SignalsCodes.popular_section },
        { title: main_sections.recent.title, value: SignalsCodes.lasted_section },
        { title: main_sections.history.title, value: SignalsCodes.history_section },
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
        //ChapterAccessOptions.suscribe,
        $.exit,
    ], '', 0, 'select')
}
export const historyChapterOptions = (title: string) => {
    const $ = OptionsFactory()
    return SectionPrompt(configuration.options_title, [
        $.resume_read,
        $.getChapters,
        $.download,
        //ChapterAccessOptions.suscribe,
        $.exit,
    ], title, 0, 'select')
}
export const popularMangaSelectOptions = (title: string) => {
    const $ = OptionsFactory()
    return SectionPrompt(configuration.options_title, [
        $.read,
        $.getChapters,
        $.download,
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

export const historyConfigurationPrompt = () => {
    const { history } = configuration
    const history_filter: PromptObject = {
        type: 'toggle',
        name: 'value',
        message: history.history_filter
    }
    const history_size: PromptObject = {
        type: 'number',
        name: 'value',
        min: 32,
        max: 4096,
        message: history.history_size
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
            title: chapter_access_options.exit.title,
            value: SignalsCodes.exit
        }
    ]
    return SectionPrompt(main_sections.history.title, choices, '', 0, 'select')
}
