import prompts, { type Choice } from "@alex_521/prompts";
import esc from "ansi-escapes";
import { DOWNLOADS_DEFAULT_DIR, WELCOME_MESSAGE } from "../const.js";
import { Configuration } from "../functions/configuration.js";
import { mangaServerRegister as ServerRegister } from "../clients/port.js";
import {
  configurationPrompt,
  confirmPrompt,
  languagePrompt,
  serverPrompt,
} from "./prompts.js";
import { ConfigurationOptions } from "../types/enum.js";
import type { ServerConfInterface, MangaServerInterface, ServerName, ConfigurationInterface } from "src/types/types.js";

export const clearScreen = () => {
  console.log(esc.clearViewport);
  console.log(WELCOME_MESSAGE);
};
export async function configurationUI() {
  clearScreen();
  const confInstance = await Configuration.getInstance();
  let confApi = confInstance.configuration;
  const confirmChages = async () => {
    let res = await prompts(confirmPrompt("You have unsaved changes. Do you want to save them before exiting?"));
    if (res) await confInstance.setConfig(confApi);
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
        confApi.client = await serverCfg(confApi.client);
        break
      case ConfigurationOptions.language:
        clearScreen();
        while (true) {
          const langSelect = await prompts(languagePrompt(confApi.language));
          if (!langSelect.target) break;
          confApi.language = langSelect.target;
          clearScreen();
        }
        break
      case ConfigurationOptions.save:
        await confInstance.setConfig(confApi);
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
async function serverCfg(context: ServerConfInterface) {
  clearScreen();
  const serverChoices = (Object.keys(ServerRegister) as ServerName[]).map((serv,i): Choice => ({
      value: serv,
      title: ServerRegister[serv].name,
      description: `need a browser?: ${ServerRegister[serv].need_browser}`,
  }));
  const InstConf = await Configuration.getInstance()
  let currentServ = InstConf.configuration.client;
  while (true) {
    const server = await prompts(serverPrompt(currentServ.name, serverChoices));
    if (!server.target) {
      break;
    }
    context = ServerRegister[server.target as ServerName];
    clearScreen();
  }
  return context;
}
async function downloads() {}
