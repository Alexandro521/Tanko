import prompts, { type Choice } from "@alex_521/prompts";
import esc from "ansi-escapes";
import { DOWNLOADS_DEFAULT_DIR, WELCOME_MESSAGE } from "../const.js";
import { Configuration } from "../functions/configuration.js";
import { mangaServerRegister as ServerRegister, type Client } from "../clients/port.js";
import {
  configurationPrompt,
  confirmPrompt,
  languagePrompt,
  serverPrompt,
} from "./prompts.js";
import { ConfigurationOptions } from "../types/enum.js"; 
import type { ServerConfInterface,MangaProvider, ServerName, ConfigurationInterface } from "../types/types.js";

export const clearScreen = () => {
  console.log(esc.clearViewport);
  console.log(WELCOME_MESSAGE);
};
export async function configurationUI() {
  clearScreen();
  const confInstance = await Configuration.getInstance();
  let currentConf = confInstance.configuration;
  const confirmChages = async () => {
    let res = await prompts(confirmPrompt("You have unsaved changes. Do you want to save them before exiting?"));
    if (res) await confInstance.setGlobalConfig(currentConf);
  };
  while (true) {
    const prompt = await prompts(configurationPrompt());
    if (!prompt.target) {
      if (isConfigChange())
        await confirmChages();
      break;
    }
    switch (prompt.target) {
      case ConfigurationOptions.Server:
        await serverCfg();
        break
      case ConfigurationOptions.language:
        clearScreen();
        let memoryChoicePosition = 0;  
        while (true) {
          const langSelect = await prompts(languagePrompt(currentConf.langKey, memoryChoicePosition));
          if (!langSelect.target) break;
          memoryChoicePosition = Number(langSelect.target.index)
          confInstance.setLanguage(langSelect.target.lang)
          clearScreen();
        }
        break
      case ConfigurationOptions.save:
        ////await confInstance.setGlobalConfig();
        break
      case ConfigurationOptions.restoreDefault:
        break
      case ConfigurationOptions.exit:
        if (isConfigChange())
          await confirmChages()
        break
    }
    clearScreen();
  }
}

function isConfigChange(): boolean {
  return false;

  /*  let changed = false;
    Object.keys(configurationObject).forEach(key => {
        if (configurationObject[key as keyof ConfigurationInterface] !== config.) {
            changed = true;
        }
    });
    return changed;*/
}
async function serverCfg() {
  clearScreen();
  const serverChoices = ServerRegister.map((server): Choice => ({
      value: server,
      title: server.name,
      description: `need a browser?: ${server.need_browser ? 'Yes' : 'No'}`,
  }));
  const configInstance = await Configuration.getInstance()

  while (true) {
    const server = await prompts(serverPrompt(configInstance.getServerInfo().name, serverChoices));
    if (!server.target) break;
    await configInstance.setServer(server.target)
    clearScreen();
  }
}


async function downloads() {}
