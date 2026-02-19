import fs from "fs";
import fsPromise from "fs/promises";
import type { Page } from "playwright";
import { z } from "zod";
import { CONFIG_FILE_PATH, DOWNLOADS_DEFAULT_DIR } from "../const.js";
import { mangaServerRegister } from "../server/port.js";
import type { ConfigurationInterface, MangaServerInterface } from "../types.js";

const schema = z.object({
    server: z.string(),
    deepSearch: z.boolean(),
    downloads_path: z.string(),
    language: z.string()
})

export class Configuration {

    static config: ConfigurationInterface = {
        server: 'leerCapitulo',
        deepSearch: false,
        downloads_path: DOWNLOADS_DEFAULT_DIR,
        language: 'es'
    }
    static server: MangaServerInterface
    static context: Page

    static async loadConfiguration() {
        try{
            if(!fs.existsSync(CONFIG_FILE_PATH)) {
                await this.storeConfiguration(this.config)
            }
            const configFile = await fsPromise.readFile(CONFIG_FILE_PATH, 'utf-8');
            const parsed = JSON.parse(configFile)
            const validated = schema.parse(parsed)
            this.config = validated
            this.server = mangaServerRegister.has(this.config.server) ? new (mangaServerRegister.get(this.config.server) as any)(this.context) : null
            if (!this.server) throw new Error("Server not found in register")
        }catch(error) {
            if(error instanceof z.ZodError) {
                console.error(error.issues)
            }else {
                console.error("Error loading configuration: ", error)
            }
        }
    }

    static async storeConfiguration(config?: ConfigurationInterface) {
        try {
        const toSave = config || this.config
        await fsPromise.writeFile(CONFIG_FILE_PATH, JSON.stringify(toSave, null, '\t'), 'utf-8')
        }catch(error) {
            console.error("Error saving configuration: ", error)
        }
    }

    static async restoreDefaultConfiguration() {
        this.config = {
            server: 'leerCapitulo',
            deepSearch: false,
            downloads_path: DOWNLOADS_DEFAULT_DIR,
            language: 'es'
        }
        await this.storeConfiguration(this.config)
    }
    
    static async setConfiguration(config: Partial<ConfigurationInterface>) {
        try {
            const validated = schema.parse({...this.config, ...config})
            this.config = validated
            this.server = mangaServerRegister.has(this.config.server) ? new (mangaServerRegister.get(this.config.server) as any)(this.context) : null
            await this.storeConfiguration(this.config)
        }catch(error) {
            if(error instanceof z.ZodError) {
                console.error(error.issues)
            }
        }
    }
}