import es from "../lang/es.json" with {type : "json"};
import en from "../lang/en.json" with {type : "json"};
import fr from "../lang/fr.json" with {type : "json"};

export type LanguageInterface = typeof es
export type LanguageErrorMessages = LanguageInterface['err_messages']
export type LanguageAccessOptions = LanguageInterface['chapter_access_options']
export type LanguageConfiguaration = LanguageInterface['configuration']
export type LanguageMainSections = LanguageInterface['main_sections']
export type LanguageLoadingStates = LanguageInterface['loading_states']
export type LanguageReader = LanguageInterface['reader']
export type LangIso = keyof LanguageConfiguaration['lang_iso']

export type AvalibleLanguageInterface = 'es' | 'en' | 'fr'
export const LANGUAGE_REGISTER: {[key in AvalibleLanguageInterface]: typeof es} = {
    es,
    en,
    fr
} as const;
