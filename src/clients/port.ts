import {MangaServerClient} from "./leerCapitulo.js"
import { MangaDex } from "./mangadex.js"
import type { MangaServerInterface,  ConfigurationClient} from "../types/types.js"
import type { Page } from "playwright"

interface Client extends ConfigurationClient {
    client:  (e:Page) => MangaServerInterface
}
type RegisterInterface = {
    [key in ConfigurationClient['name']]: Client
}

export const mangaServerRegister: RegisterInterface = {
    'leercapitulo': {
        name: 'leercapitulo',
        need_browser: true,
        client: (e: Page) => new MangaServerClient(e),
    },
    'mangadex': {
        name: 'mangadex',
        need_browser: false,
        client: (e:Page) => new MangaDex()
    }
}


