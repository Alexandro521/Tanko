import ansi from 'ansi-escapes'
import supportsHyperlinks from 'supports-hyperlinks'
import prompts from '@alex_521/prompts'
import boxen from 'boxen'
import chalk from 'chalk'
import { stdout } from 'node:process'
import fs from 'fs/promises'
import type { Query } from '../types/anilist-schema.js'
import { DATA_DEFAULT_DIR } from '../const.js'
import path from 'node:path'

export class AniList {
    private endPoint = 'https://graphql.anilist.co'
    constructor() {

    }
    async loginTui() {
        let logMessage = ''
        let [width, height] = [Math.min(stdout.columns, 80), Math.min(stdout.rows - 2, 5)]
        const chalkf = (txt: string) => chalk.underline(chalk.italic(chalk.blue(txt)))
        const authUrl = "https://anilist.co/api/v2/oauth/authorize?client_id=44346&response_type=token"
        let attempts = 8

        if (supportsHyperlinks.stdout) {
            logMessage =
                chalk.white('Open this link in your browser to log in to AniList → ') +
                ansi.link(chalkf('click me!'), authUrl)
        } else {
            width = Math.max(width, authUrl.length + 4)
            logMessage =
                chalk.white('Click this link to log in to AniList\n') +
                chalkf(authUrl) + '\n\n'
        }
        const box = boxen(
            logMessage,
            {
                width,
                height,
                borderStyle: 'round',
                borderColor: 'magenta',
                title: chalk.magentaBright('AniList Login'),
                textAlignment: 'center',
                padding: 1
            })

        console.log(box)
        
        while (attempts > 0) {
            const prompt = await prompts<'token'>({
                type: 'invisible',
                message: chalk.blackBright('Paste the Token'),
                name: 'token'
            })

            if (!prompt.token) {
                console.log(chalk.yellowBright('Authentication cancelled.'))
                break
            }
            const userData = await this.viewer(prompt.token)
            if (userData) {
                const msg = `Welcome to Tanko ${chalk.magenta(userData.name)}!`
                console.log(chalk.greenBright('Successful authentication.\n'), msg)
                await fs.writeFile(path.join(DATA_DEFAULT_DIR, 'anilist_tok'), prompt.token)
                break
            } else {
                console.log(chalk.redBright('Authentication failed'))
                if (--attempts <= 0) {
                    console.log(chalk.yellowBright(`Too many failed attempts, please verify your token.`))
                }
            }
        }
    }

    async viewer(token: string): Promise<Query['Viewer'] | undefined> {
        const query = `
            query getUser{
                Viewer {
                    id
                    name
                }
            }
        `
        const headers = new Headers()
        headers.append('Authorization', `Bearer ${token}`)
        headers.append('Content-Type', 'application/json')
        headers.append('Accept', 'application/json')
        const res = await fetch(this.endPoint, {
            method: 'POST',
            headers,
            body: JSON.stringify({ query: query })
        })
        const json = await res.json()
        if (res.ok) {
            return {
                name: json.data.Viewer.name,
                id: json.data.Viewer.id
            }
        } else {
            return undefined
        }
    }
}