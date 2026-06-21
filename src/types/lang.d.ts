export interface LangInterface {
  meta: Meta
  main_sections: MainSections
  chapter_access_options: ChapterAccessOptions
  configuration: Configuration
  loading_states: LoadingStates
  err_messages: ErrorMessages
  reader: Reader
}

export interface Meta {
  lang_version: string
  lang: string
}

export interface MainSections {
  main: Sections
  search: Sections
  recent: Sections
  popular: Sections
  history: Sections
  config: Sections
  exit: Sections
}

export interface Sections {
  title: string
  alt: string
}

export interface ChapterAccessOptions {
  read: AccessOptions
  download: AccessOptions
  resume_read: AccessOptions
  suscribe: AccessOptions
  get_chapters: AccessOptions
  exit: AccessOptions
  prev_ch: AccessOptions
  next_ch: AccessOptions
}

export interface AccessOptions {
  title: string
  desc: string
}

export interface Configuration {
  options: Options
  "lang-ui": LangUi
  unsaved_changes: string
  need_browser: string
  yes: string
  no: string
  server_title: string
  options_title: string
  select_lang_title: string
}

export interface Options {
  "lang-ui": string
  save: string
  client: string
  downloads: string
  search: string
  restore: string
}

export interface LangUi {
  es: string
  en: string
}

export interface Reader {
  prev_page: string
  next_page: string
  exit: string
  prev_ch: string
  next_ch: string
  options: string
}

interface ErrorDetail {
  msg: string;
  hint: string;
}

interface LoadingStates {
  loading_chapters: string;
  loading_chapter: string;
  default_loading: string;
  searching: string;
  browser_init: string;
  browser_close: string;
  downloading_pages: string;
  downloading_chapter: string;
  default_downloading: string; // Note: kept the typo from the original JSON
  next_chapter: string;
  prev_chapter: string;
  reloading_chapter: string;
  retry: string;
}

interface ErrorMessages {
  network: ErrorDetail;
  fetching: ErrorDetail;
  pdf_make: ErrorDetail;
  client_switch: ErrorDetail;
  corrupt_conf_file: ErrorDetail;
  corrupt_history_file: ErrorDetail;
  page_loading: ErrorDetail;
  chapter_loading: ErrorDetail;
  /**----- */
  no_results: ErrorDetail
  void_Section: ErrorDetail
}

export interface AppConfig {
  loading_states: LoadingStates;
  err_messages: ErrorMessages;
}
export type AvalibleLangs = 'es' | 'en'
