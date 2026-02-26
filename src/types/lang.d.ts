export interface LangInterface {
  meta: Meta
  main_sections: MainSections
  chapter_access_options: ChapterAccessOptions
  configuration: Configuration
}

export interface Meta {
  lang_version: string
  lang: string
}

export interface MainSections {
  main: Main
  search: Search
  recent: Recent
  popular: Popular
  history: History
  config: Config
  exit: Exit
}

export interface Main {
  title: string
  alt: string
}

export interface Popular {
  title: string,
  alt: string
}

export interface Search {
  title: string
  alt: string
}

export interface Recent {
  title: string
  alt: string
}

export interface History {
  title: string
  alt: string
}

export interface Config {
  title: string
  alt: string
}

export interface Exit {
  title: string
  alt: string
}

export interface ChapterAccessOptions {
  read: Read
  download: Download
  resume_read: ResumeRead
  suscribe: Suscribe
  get_chapters: GetChapters
  exit: Exit2
  prev_ch: PrevCh
  next_ch: NextCh
}

export interface Read {
  title: string
  desc: string
}

export interface Download {
  title: string
  desc: string
}

export interface ResumeRead {
  title: string
  desc: string
}

export interface Suscribe {
  title: string
  desc: string
}

export interface GetChapters {
  title: string
  desc: string
}

export interface Exit2 {
  title: string
  desc: string
}

export interface PrevCh {
  title: string
  desc: string
}

export interface NextCh {
  title: string
  desc: string
}

export interface Configuration {
  options: Options
  "lang-ui": LangUi
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
