import { MangaServerClient } from "./leerCapitulo.js";
import { MangaDex } from "./mangadex.js";
import type {
  MangaServerInterface,
  ServerConfInterface,
} from "../types/types.js";
import type { Page } from "playwright";

interface Client extends ServerConfInterface {
  client: (e: Page) => MangaServerInterface;
}
type RegisterInterface = {
  [key in ServerConfInterface["name"]]: Client;
};

export const mangaServerRegister: RegisterInterface = {
  leercapitulo: {
    name: "leercapitulo",
    need_browser: true,
    client: (e: Page) => new MangaServerClient(e),
  },
  mangadex: {
    name: "mangadex",
    need_browser: false,
    client: (e: Page) => new MangaDex(),
  },
};
