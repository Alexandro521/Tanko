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
