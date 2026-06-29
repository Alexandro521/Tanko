import ansi from 'ansi-escapes'
import supportsHyperlinks from 'supports-hyperlinks'
import prompts from '@alex_521/prompts'
import boxen from 'boxen'
import chalk from 'chalk'
import { stdout } from 'node:process'
import fsPromise from 'fs/promises'
import fs from 'fs'
import { DATA_DEFAULT_DIR } from '../const.js'
import path from 'node:path'
import { Notify, NotifyType } from '../functions/notify.js'

import type { TrackerIntegration, TrackerNames } from '../types/types.js'
const NOTIFY = Notify.getInstace()

export class AniList implements TrackerIntegration{
    private endPoint = 'https://graphql.anilist.co'
    private tokenpath = path.join(DATA_DEFAULT_DIR, 'anilist_token')
    private static singletonInstance: AniList
    public trackerName: TrackerNames = 'anilist'
    private constructor(){}
    static getInstance(){
        if(!this.singletonInstance) {
            this.singletonInstance = new AniList()
        }
        return this.singletonInstance
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
                NOTIFY.push({
                    message: 'Authentication cancelled.',
                    type: NotifyType.warning,
                    title: 'Notify'
                })
                break
            }
            const userData = await this.viewer(prompt.token)
            let msg = ''
            if (userData) {
                NOTIFY.push({
                    message: `Welcome to Tanko ${chalk.magenta(userData.name)}!`,
                    title: chalk.blueBright('Successful authentication.'),
                    type: NotifyType.event
                })
                await fsPromise.writeFile(this.tokenpath, prompt.token)
                break
            } else {
                console.log(chalk.redBright('Authentication failed'))
                if (--attempts <= 0) {
                    NOTIFY.push({
                        type: NotifyType.warning,
                        title: chalk.yellowBright('Authentication failed'),
                        message: chalk.yellowBright(`Too many failed attempts, please verify your token.`)
                    })
                }
            }
        }
    }
    async login(){
        if(!fs.existsSync(this.tokenpath)) return undefined
        const token = await fsPromise.readFile(this.tokenpath, {encoding: 'utf-8'})
        const userInfo = await this.viewer(token)
        if(userInfo) return userInfo
        else return undefined
    }
    private async request(query:string, variables = '', token = '') {
        try{
            const headers = new Headers()
            headers.append('Authorization', `Bearer ${token}`)
            headers.append('Content-Type', 'application/json')
            headers.append('Accept', 'application/json')
            const req = await fetch(this.endPoint, {
                method: 'POST',
                headers,
                body: JSON.stringify({ 
                    query: query
                })
            })
            if(!req.ok) return undefined
            const res = await req.json()
            return res.data
        }catch{
            return undefined
        }
    }
    private async viewer(token: string) {
        const query = `
            query getUser{
                Viewer {
                    id
                    name
                }
            }
        `
        const res = await this.request(query, '', token)
        if (res && res.Viewer) {
            return {
                name: res.Viewer.name,
                id: res.Viewer.id
            }
        } else {
            return undefined
        }
    }
    async logout() {
        await fsPromise.rm(this.tokenpath)
    }
}
