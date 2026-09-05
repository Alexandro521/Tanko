
export type LanguageInterface = Awaited<ReturnType<typeof LANGUAGE_REGISTER['en']>>
export type LanguageErrorMessages = LanguageInterface['err_messages']
export type LanguageAccessOptions = LanguageInterface['chapter_access_options']
export type LanguageConfiguaration = LanguageInterface['configuration']
export type LanguageMainSections = LanguageInterface['main_sections']
export type LanguageLoadingStates = LanguageInterface['loading_states']
export type LanguageReader = LanguageInterface['reader']
export type LangIso = keyof LanguageConfiguaration['lang_iso']
export type AvalibleLanguageInterface = keyof typeof LANGUAGE_REGISTER

export const LANGUAGE_REGISTER = {
    es: async ()=> ( await import('../lang/es.json', {with: {type: "json"}})).default,
    fr: async ()=> ( await import('../lang/fr.json', {with: {type: "json"}})).default,
    en: async ()=> ( await import('../lang/en.json', {with: {type: "json"}})).default
};

