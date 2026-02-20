import {MangaServerClient} from "./leerCapitulo.js"
import {MangaServerInterface} from "../types/types.js"


export const mangaServerRegister = new Map<string, typeof MangaServerInterface>([
    ['leerCapitulo', MangaServerClient],
])


