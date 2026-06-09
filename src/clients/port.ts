import { MangaServerClient } from "./leerCapitulo.js";
import { MangaDex } from "./mangadex.js";
import type {
  MangaServerInterface,
  ServerConfInterface,
  ServerName,
} from "../types/types.js";
import type { Page } from "playwright";

export interface Client extends ServerConfInterface {
  client: (e: Page) => MangaServerInterface;
}
export type ServerRegister = Client[]

export const mangaServerRegister: ServerRegister =
  [ 
  {
    name: "leercapitulo",
    need_browser: true,
    client: (e: Page) => new MangaServerClient(e),
  },
  {
    name: "mangadex",
    need_browser: false,
    client: (e: Page) => new MangaDex(),
  }
]
