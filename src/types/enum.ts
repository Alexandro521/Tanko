export enum ConfigurationOptions {
    Server = 13,
    Search = 29,
    language =31,
    downloads = 35,
    downloadPath = 65,
    save = 33,
    restoreDefault = 24,
    exit = 0,
    accout = 9
}

export enum SignalsCodes {
    see_profile =423,
    logout_accout =421,
    download_chapter = 46,
    read_chapter = 36,
    get_chapters_list = 26,
    resume_read = 37,
    exit = -1,
    main = 233,
    lasted_section = 343,
    history_section = 453,
    configuration_section = 563,
    search_section = 673,
    next_chapter = 27,
    previous_chapter = 29,
    delete_from_history = 456,
    delete_history = 499,
    popular_section= 783,
    nullElement = -35454,
    suscribe_manga = 654,
}

export enum DownloadFormat {
    pdf = 'pdf',
    img = 'jpeg',
    zip = 'zip',
    cbz = 'cbz'
}

export enum ConfigurationEvents {
    updateServer = 'updateserver',
    updateLanguage = 'updateLang',
    loadConfiguration = 'loadConf',
    updateGlobal = 'updateGlobal',
    storeConfFile = 'storeFile',
    failedLoad = 'failLoading',
    browserClose = 'browserClose',
    browserLoaded = 'browserOpen',
    login = 'login'
}

//? [ANILIST]
/** Media list watching/reading status enum. */
export enum MediaListStatus {
  /** Finished watching/reading */
  Completed = 'COMPLETED',
  /** Currently watching/reading */
  Current = 'CURRENT',
  /** Stopped watching/reading before completing */
  Dropped = 'DROPPED',
  /** Paused watching/reading */
  Paused = 'PAUSED',
  /** Planning to watch/read */
  Planning = 'PLANNING',
  /** Re-watching/reading */
  Repeating = 'REPEATING'
}

/** Media sort enums */
export enum MediaSort {
  Chapters = 'CHAPTERS',
  ChaptersDesc = 'CHAPTERS_DESC',
  Duration = 'DURATION',
  DurationDesc = 'DURATION_DESC',
  EndDate = 'END_DATE',
  EndDateDesc = 'END_DATE_DESC',
  Episodes = 'EPISODES',
  EpisodesDesc = 'EPISODES_DESC',
  Favourites = 'FAVOURITES',
  FavouritesDesc = 'FAVOURITES_DESC',
  Format = 'FORMAT',
  FormatDesc = 'FORMAT_DESC',
  Id = 'ID',
  IdDesc = 'ID_DESC',
  Popularity = 'POPULARITY',
  PopularityDesc = 'POPULARITY_DESC',
  Score = 'SCORE',
  ScoreDesc = 'SCORE_DESC',
  SearchMatch = 'SEARCH_MATCH',
  StartDate = 'START_DATE',
  StartDateDesc = 'START_DATE_DESC',
  Status = 'STATUS',
  StatusDesc = 'STATUS_DESC',
  TitleEnglish = 'TITLE_ENGLISH',
  TitleEnglishDesc = 'TITLE_ENGLISH_DESC',
  TitleNative = 'TITLE_NATIVE',
  TitleNativeDesc = 'TITLE_NATIVE_DESC',
  TitleRomaji = 'TITLE_ROMAJI',
  TitleRomajiDesc = 'TITLE_ROMAJI_DESC',
  Trending = 'TRENDING',
  TrendingDesc = 'TRENDING_DESC',
  Type = 'TYPE',
  TypeDesc = 'TYPE_DESC',
  UpdatedAt = 'UPDATED_AT',
  UpdatedAtDesc = 'UPDATED_AT_DESC',
  Volumes = 'VOLUMES',
  VolumesDesc = 'VOLUMES_DESC'
}