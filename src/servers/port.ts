import type {
  MangaProvider,
  ProviderConfInterface,
} from "../types/types.js";
import type { Page } from "playwright";

export interface Client extends ProviderConfInterface {
  client: (e: Page) => Promise<MangaProvider>;
}

export type ServerRegister = Client[]
export const mangaServerRegister: ServerRegister =
  [
  {
    name: "leercapitulo",
    need_browser: true,
    client: async (e: Page) => {
      const {LeerCapitulo} = await import('./leerCapitulo.ts')
      return new LeerCapitulo(e)},
  },
  {
    name: "mangadex",
    need_browser: false,
    client: async (_: Page) => {
      const {MangaDex} = await import('./mangadex.ts')
      return new MangaDex()
    }
  },
  {
    name: "katana",
    need_browser: false,
    client: async (_: Page) => {
      const {MangaKatana} = await import('./katana.ts')
      return new  MangaKatana()
    } 
  },
    {
      name: 'mangapill',
      need_browser: false,
      client: async (_:Page) => {
        const {MangaPill} = await import('./mangapill.ts')
        return new MangaPill()
      }
  }
]
