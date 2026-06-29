import prompts, { type Choice } from "@alex_521/prompts";
import esc from "ansi-escapes";
import { DOWNLOADS_DEFAULT_DIR, WELCOME_MESSAGE } from "../const.js";
import { Configuration } from "../functions/configuration.js";
import { mangaServerRegister as ServerRegister, type Client } from "../servers/port.js";
import {
  accoutOptionsPrompt,
  accoutPrompt,
  configurationPrompt,
  languagePrompt,
  serverPrompt,
} from "./prompts.js";
import { ConfigurationOptions, SignalsCodes } from "../types/enum.js"; 
import type {TrackerProps } from "../types/types.js";
import { Sign } from "node:crypto";


export async function configurationUI() {
  const confInstance = await Configuration.getInstance();
  let currentConf = confInstance.configuration;
  let whileStatus = true
  while (true) {
    const prompt = await prompts(configurationPrompt());
    if (!prompt.target || prompt.target === SignalsCodes.exit) {
      break;
    }
    switch (prompt.target) {
      case ConfigurationOptions.Server:
        await serverCfg();
        break
      case ConfigurationOptions.language:
        let memoryChoicePosition = 0;  
        while (true) {
          const langSelect = await prompts(languagePrompt(currentConf.langKey, memoryChoicePosition));
          if (!langSelect.target) break;
          memoryChoicePosition = Number(langSelect.target.index)
          confInstance.setLanguage(langSelect.target.lang)
          currentConf = confInstance.configuration
        }
        break
      case ConfigurationOptions.accout:
        await accoutConf()
        break
      case ConfigurationOptions.restoreDefault:
        whileStatus = false
        break
    }

  }
}


async function serverCfg() {

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
  }
}
async function accoutConf() {
const confInstance = await Configuration.getInstance();

  let whileStatus = true
  while(whileStatus){
    const prompt = await prompts(accoutPrompt())
    if(!prompt.target || prompt.target === SignalsCodes.exit) {
      whileStatus = false
      break
    }
    const log = prompt.target as TrackerProps
    const tracker = log.integration
    if(!log.isAuth || !log.data) {
      await log.integration.loginTui()
      await confInstance.login(tracker.trackerName)
      continue
    }
    const accoutOption = await prompts(accoutOptionsPrompt(tracker.trackerName,log.data.name))
    if(!accoutOption.target || accoutOption.target === SignalsCodes.exit){
      continue
    }
    switch(accoutOption.target){
      case SignalsCodes.logout_accout:
        await confInstance.logout(tracker.trackerName)
        break
      case SignalsCodes.see_profile: 
        break
    }
  }
}
async function downloads() {}
