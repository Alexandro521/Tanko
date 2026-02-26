import prompts, { type Choice } from "@alex_521/prompts";
import esc from "ansi-escapes";
import {  DOWNLOADS_DEFAULT_DIR, WELCOME_MESSAGE } from "../const.js";
import { Configuration } from "../functions/configuration.js";
import { mangaServerRegister } from "../clients/port.js";
import { configurationPrompt, confirmPrompt, languagePrompt, serverPrompt } from "./prompts.js";
import { ConfigurationOptions } from "../types/enum.js";

export const clearScreen = () => {
    console.log(esc.clearViewport);
    console.log(WELCOME_MESSAGE);
}
const servers = Array.from(Object.keys(mangaServerRegister)).map((server): Choice => {
    return {
        title: server,
        value: server,
    }
})

export async function configurationUI() {
    const config = await Configuration.getInstance()
    let configurationObject = config.configuration
    clearScreen()

    while (true) {

        const prompt = await prompts(configurationPrompt())

        if (!prompt.target) {

            if (isConfigChange()) {
                let res = await prompts(confirmPrompt("You have unsaved changes. Do you want to save them before exiting?"))
                if (res) {
                    await config.setConfig(configurationObject)
                }
            }
            break;
        }

        if (prompt.target === ConfigurationOptions.Server) {
            configurationObject.client = await server(configurationObject.client.name)
        } else if (prompt.target === ConfigurationOptions.language) {
            configurationObject.language = await language(configurationObject.language)
        } else if (prompt.target === ConfigurationOptions.save) {
            await config.setConfig(configurationObject)
        } else if (prompt.target === ConfigurationOptions.restoreDefault) {
          //  await config.setConfig()
        } else if (prompt.target === ConfigurationOptions.exit) {
            if (isConfigChange()) {
                const res = await prompts(confirmPrompt("You have unsaved changes. Do you want to save them before exiting?"))
                if (res) {
                    await config.setConfig(configurationObject)
                }
            }
            break;
        }
        clearScreen()
    }
}

function isConfigChange(): boolean {
    return false

  /*  let changed = false;
    Object.keys(configurationObject).forEach(key => {
        if (configurationObject[key as keyof ConfigurationInterface] !== config.) {
            changed = true;
        }
    });
    return changed;*/
}

async function server(currentClient: string) {
    clearScreen()
    const ch: Choice[] = Object.keys(mangaServerRegister).map((key):Choice =>{
        return {
            title: mangaServerRegister[key as keyof typeof mangaServerRegister].name,
            description: `need a browser: ${mangaServerRegister[key as keyof typeof mangaServerRegister].need_browser}`,
            value: mangaServerRegister[key as keyof typeof mangaServerRegister]
        }
    })
    let sv = mangaServerRegister[currentClient as keyof typeof mangaServerRegister]
    while (true) {
        const server = await prompts(serverPrompt(currentClient, ch))
        if (!server.target) {
            break;
        }
        currentClient = server.target.name
        sv = server.target as typeof mangaServerRegister.leercapitulo
        clearScreen()
    }
    return sv
}

async function language(currentLang: string) {
    clearScreen()
    let lang = currentLang;
    while (true) {
        const langSelect = await prompts(languagePrompt(currentLang))
        if (!langSelect.target) {
            break;
        }
        currentLang = langSelect.target
        lang = langSelect.target
        clearScreen()
    }
    return lang as 'es' | 'en'
}

async function downloads() {

}