import { LeerCapitulo } from "./leerCapitulo.ts"
import { MangaDex } from "./mangadex.ts"
import { MangaKatana } from "./katana.ts"
import type {
  MangaProvider,
  ProviderConfInterface,
  ServerName,
} from "../types/types.js";
import type { Page } from "playwright";

export interface Client extends ProviderConfInterface {
  client: (e: Page) => MangaProvider;
}
export type ServerRegister = Client[]

export const mangaServerRegister: ServerRegister =
  [
  {
    name: "leercapitulo",
    need_browser: true,
    client: (e: Page) => new LeerCapitulo(e),
  },
  {
    name: "mangadex",
    need_browser: false,
    client: (_: Page) => new MangaDex(),
    },
  {
    name: "katana",
    need_browser: false,
    client: (_: Page) => new  MangaKatana(),
  }
]
