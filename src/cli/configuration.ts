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

export async function configurationTui() {
  const configuration = await Configuration.getInstance();
  let settings = configuration.settings;
  let whileStatus = true

  while (true) {
    const prompt = await prompts(configurationPrompt());
    if (!prompt.target || prompt.target === SignalsCodes.exit) {
      break;
    }
    switch (prompt.target) {
      case ConfigurationOptions.Server:
        await providerConfigurationTui();
        break
      case ConfigurationOptions.language:
        let memoryChoicePosition = 0;  
        while (true) {
          const langSelect = await prompts(languagePrompt(settings.languageISO, memoryChoicePosition));
          if (langSelect.target) {
            memoryChoicePosition = Number(langSelect.target.index)
            configuration.setLanguage(langSelect.target.lang)
            settings = configuration.settings
          } else break
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

async function providerConfigurationTui() {
  const configInstance = await Configuration.getInstance()
  const langObj = await configInstance.getLanguageInterface()
  const { configuration: localizedConfig } = langObj
  const serverChoices = ServerRegister.map((server): Choice => ({
      value: server,
      title: server.name,
      description: `${localizedConfig.need_browser} ${server.need_browser ? localizedConfig.yes : localizedConfig.no}`,
  }));

  while (true) {
    const server = await prompts(serverPrompt(configInstance.conf_provider.providerInfo.name, serverChoices));
    if (!server.target) break;
    await configInstance.conf_provider.setServer(server.target)
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
    const tracker = log.instance
    if(!log.isAuth || !log.data) {
      await log.instance.loginTui()
      await confInstance.conf_session.login(tracker.trackerName)
      continue
    }
    const userInfo = log.data.Viewer ?? {name: 'error', id: -1}
    const accoutOption = await prompts(accoutOptionsPrompt(tracker.trackerName, userInfo.name))
    if(!accoutOption.target || accoutOption.target === SignalsCodes.exit){
      continue
    }
    switch(accoutOption.target){
      case SignalsCodes.logout_accout:
        await confInstance.conf_session.logout(tracker.trackerName)
        break
      case SignalsCodes.see_profile: 
        break
    }
  }
}

async function downloads() {}
