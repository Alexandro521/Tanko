import prompts, { type Choice } from "@alex_521/prompts";
import esc from "ansi-escapes";
import chalk from "chalk";
import { PRIMARY_COLOR, WELCOME_MESSAGE } from "../const.js";
import { Configuration } from "../functions/configuration.js";
import { mangaServerRegister } from "../server/port.js";
import type { ConfigurationInterface } from "../types.js";

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

enum ConfigurationOptions {
    Server = 13,
    Search = 29,
    language =31,
    downloads = 35,
    downloadPath = 65,
    save = 33,
    restoreDefault = 24,
    exit = 0,
}


const configurationOptions: Choice[] =  [
    {
        title: "Server",
        value: ConfigurationOptions.Server,
    },
    {
        title: "Search",
        value: ConfigurationOptions.Search,
    },
    {
        title: "Language",
        value: ConfigurationOptions.language,
    },
    {
        title: "Downloads",
        value: ConfigurationOptions.downloads,
    },
    {
        title: "Save",
        value: ConfigurationOptions.save,
    },
    {
        title: "Restore Default",
        value: ConfigurationOptions.restoreDefault,
    }
]
let configurationObject: Partial<ConfigurationInterface> = {}

export async function configurationUI () {
    configurationObject = Configuration.config
    clearScreen()
    while(true) {
        const prompt = await prompts({
            type: "select",
            name: "option",
            message: chalk.bgHex(PRIMARY_COLOR)(" Configuracion "),
            choices: configurationOptions,
        })

        if (!prompt.option) {
            if (isConfigChange()) {
                let res = await prompts({
                    type: "confirm",
                    name: "exit",
                    message: "You have unsaved changes. Do you want to save them before exiting?",
                })
                if (res) {
                    await Configuration.setConfiguration(configurationObject)
                }
            }
            break;
        }

        if (prompt.option === ConfigurationOptions.Server) {
            await server()
        } else if (prompt.option === ConfigurationOptions.language) {
            await language()
        } else if (prompt.option === ConfigurationOptions.save) {
            await Configuration.setConfiguration(configurationObject)
        } else if (prompt.option === ConfigurationOptions.restoreDefault) {
            await Configuration.restoreDefaultConfiguration()
        } else if (prompt.option === ConfigurationOptions.exit) {
            if (isConfigChange()) {
                const res = await prompts({
                    type: "confirm",
                    name: "exit",
                    message: "You have unsaved changes. Do you want to save them before exiting?",
                })
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

async function server( ){
    clearScreen()
    while(true) {  
        const serverPrompt = await prompts({
                type: "select",
                name: "server",
                hint: `Current: ${configurationObject.server || Configuration.config.server}`,
                message: "Server",
                choices: servers,
            })
        if(!serverPrompt.server){
            break;
        }
        configurationObject["server"] = serverPrompt.server
        clearScreen()
    }
}

async function language() {
    clearScreen()
    while (true) {
        const languagePrompt = await prompts({
            type: "select",
            name: "language",
            hint: `Current: ${configurationObject.language || Configuration.config.language}`,
            message: "Language",
            choices: [
                { title: "Spanish", value: "es" },
                { title: "English", value: "en" },
                { title: "French", value: "fr" },
                {title: "japanese", value: "jp"},
            ],
        })

        if (!languagePrompt.language) {
            break;
        }
        configurationObject["language"] = languagePrompt.language
        clearScreen()
    }
}

async function downloads( ){

}