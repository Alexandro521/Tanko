import {MangaServerClient} from "./leerCapitulo.js"
import type {MangaServerInterface} from "../types/types.js"


export const mangaServerRegister = new Map<string, typeof MangaServerInterface>([
    ['leerCapitulo', MangaServerClient],
])


