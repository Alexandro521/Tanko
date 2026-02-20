export interface LangInterface {
  main_sections: MainSections
  search_section: SearchSection
  chapter_select_options: ChapterSelectOptions
  reader_options: ReaderOptions
  history_section: HistorySection
}

export interface MainSections {
  configuration: string
  exit: string
  search: string
  popular: string
  lasted: string
  history: string
}

export interface SearchSection {
  result_hint: string
  no_results: string
  message: string
  chapter_hint: string
  chapter_list: string
}

export interface ChapterSelectOptions {
  read: string
  download: string
  back: string
  question: string
}

export interface ReaderOptions {
  terminal_hint: string
  next: string
  previous: string
  exit: string
}

export interface HistorySection {
  no_history: string
  message: string
  select: Select
}

export interface Select {
  resume: string
  delete: string
}
