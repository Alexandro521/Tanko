import prompts, { type Choice } from "@alex_521/prompts";
import esc from "ansi-escapes";
import {  WELCOME_MESSAGE } from "../const.js";
import { Configuration } from "../functions/configuration.js";
import { mangaServerRegister } from "../clients/port.js";
import type { ConfigurationInterface } from "../types/types.js";
import { configurationPrompt, confirmPrompt, languagePrompt, serverPrompt } from "./prompts.js";
import { ConfigurationOptions } from "../types/enum.js";

export const clearScreen = () => {
    console.log(esc.clearViewport);
    console.log(WELCOME_MESSAGE);
}
const servers = Array.from(mangaServerRegister.keys()).map((server): Choice => {
    return {
        title: server,
        value: server,
    }
})

let configurationObject: Partial<ConfigurationInterface> = {}

export async function configurationUI() {
    configurationObject = Configuration.config
    clearScreen()

    while (true) {

        const prompt = await prompts(configurationPrompt)

        if (!prompt.target) {
            if (isConfigChange()) {
                let res = await prompts(confirmPrompt("You have unsaved changes. Do you want to save them before exiting?"))
                if (res) {
                    await Configuration.setConfiguration(configurationObject)
                }
            }
            break;
        }

        if (prompt.target === ConfigurationOptions.Server) {
            await server()
        } else if (prompt.target === ConfigurationOptions.language) {
            await language()
        } else if (prompt.target === ConfigurationOptions.save) {
            await Configuration.setConfiguration(configurationObject)
        } else if (prompt.target === ConfigurationOptions.restoreDefault) {
            await Configuration.restoreDefaultConfiguration()
        } else if (prompt.target === ConfigurationOptions.exit) {
            if (isConfigChange()) {
                const res = await prompts(confirmPrompt("You have unsaved changes. Do you want to save them before exiting?"))
                if (res) {
                    await Configuration.setConfiguration(configurationObject)
                }
            }
            break;
        }
        clearScreen()
    }
}

function isConfigChange(): boolean {
    let changed = false;
    Object.keys(configurationObject).forEach(key => {
        if (configurationObject[key as keyof ConfigurationInterface] !== Configuration.config[key as keyof ConfigurationInterface]) {
            changed = true;
        }
    });
    return changed;
}

async function server() {
    clearScreen()
    while (true) {

        const server = await prompts(serverPrompt(Configuration.config.server ?? configurationObject.server, servers))
        if (!server.target) {
            break;
        }
        configurationObject["server"] = server.target
        clearScreen()
    }
}

async function language() {
    clearScreen()
    while (true) {
        const lang = await prompts(languagePrompt(configurationObject.language ?? Configuration.config.language))

        if (!lang.target) {
            break;
        }
        configurationObject["language"] = lang.target
        clearScreen()
    }
}

async function downloads() {

}