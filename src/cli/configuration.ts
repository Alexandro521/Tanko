import prompts, { type Choice } from "@alex_521/prompts";
import esc from "ansi-escapes";
import { DOWNLOADS_DEFAULT_DIR, WELCOME_MESSAGE } from "../const.js";
import { Configuration } from "../functions/configuration.js";
import { mangaServerRegister as ServerRegister, type Client } from "../servers/port.js";
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
  const langObj = await confInstance.getLanguageInterface();
  const { configuration: localizedConfig } = langObj;
  const confirmChages = async () => {
    let res = await prompts(confirmPrompt(localizedConfig.unsaved_changes));
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
}
async function serverCfg() {
  clearScreen();
  const configInstance = await Configuration.getInstance()
  const langObj = await configInstance.getLanguageInterface()
  const { configuration: localizedConfig } = langObj
  const serverChoices = ServerRegister.map((server): Choice => ({
      value: server,
      title: server.name,
      description: `${localizedConfig.need_browser} ${server.need_browser ? localizedConfig.yes : localizedConfig.no}`,
  }));

  while (true) {
    const server = await prompts(serverPrompt(configInstance.getServerInfo().name, serverChoices));
    if (!server.target) break;
    await configInstance.setServer(server.target)
    clearScreen();
  }
}


async function downloads() {}
