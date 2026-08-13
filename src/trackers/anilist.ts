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
import { MediaSort } from '../types/enum.js'
import type { LoginData, MangaInfo, TrackerIntegration, TrackerNames, TrackProps} from '../types/types.js'
import { Configuration } from '../functions/configuration.ts'

interface SearchResponse {
    Page: {
        media: {
            id: number,
            idMal: number,
            popularity: number,
            title: {
                romaji: string,
                english: string,
                userPreferred: string,
            }
        }[]
    }
}

interface ReqResponse<T>{
    data?: T,
    errors?: {
        message: string,
        locations: {
            line: number,
            column: number
        }[]
    }[]
}

const NOTIFY = Notify.getInstace()
class Queries {
    static querySearch (title: string, sort: MediaSort) {
        const object = { 
            variables: {
                title,
                sort,
            },
            query: "query Search($title: String, $sort: [MediaSort]){\
                Page(perPage: 3){\
                    media(search:$title , type: MANGA, sort:$sort){\
                        id,\
                        idMal,\
                        popularity,\
                        title{\
                            romaji,\
                            english,\
                            userPreferred,\
                        },\
                    }\
                }\
            }\
        "
        }
        return JSON.stringify(object)
    }
    static mutateTrack (props: TrackProps) {
        const object = {
            variables: props,
            query:  `
                mutation track(
                    $mediaId: Int,
                    $status: MediaListStatus = CURRENT,
                    $progress: Int, 
                    $progressVolume: Int = 0, 
                    $repeat: Int = 0
                ){
                    SaveMediaListEntry(
                        mediaId: $mediaId, 
                        status: $status, 
                        progress: $progress, 
                        repeat: $repeat, 
                        progressVolumes: $progressVolume
                    ){
                        mediaId,
                        status,
                        progress,
                        progressVolumes,
                        repeat
                    }
                }`
        }
        return JSON.stringify(object)
    }
    static queryViewer () {
        const object = {
            query:"\
            query getUser{\
                Viewer {\
                    id\
                    name\
                }\
            }\
        "
        }
        return JSON.stringify(object)
    }
}

export class AniList implements TrackerIntegration{
    private static tokenpath = path.join(DATA_DEFAULT_DIR, 'anilist_token')
    private endPoint = 'https://graphql.anilist.co'
    private token:string | undefined = undefined
    private static singletonInstance: AniList
    public trackerName: TrackerNames = 'anilist'
    private constructor(token: string | undefined){
        this.token = token
    }
    static getInstance(){
        if(!this.singletonInstance) {
            this.singletonInstance = new AniList(undefined)
        }
        return this.singletonInstance
    }
    async loginTui() {
        let logMessage = ''
        const langInterface = await (await Configuration.getInstance()).getLanguageInterface()
        const lang = langInterface.configuration.accouts

        let [width, height] = [Math.min(stdout.columns, 80), Math.min(stdout.rows - 2, 5)]
        const chalkf = (txt: string) => chalk.underline(chalk.italic(chalk.blue(txt)))
        const authUrl = "https://anilist.co/api/v2/oauth/authorize?client_id=44346&response_type=token"
        let attempts = 8

        if (supportsHyperlinks.stdout) {
            logMessage =
                chalk.white(`${lang.click_on} Anilist → `) +
                ansi.link(chalkf('click me!'), authUrl)
        } else {
            width = Math.max(width, authUrl.length + 4)
            logMessage =
                chalk.white(`${lang.follow_link} Anilist\n`) + chalkf(authUrl) + '\n\n'
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
                message: chalk.blackBright(lang.paste),
                name: 'token'
            })

            if (!prompt.token) {
                NOTIFY.push({
                    message: lang.auth_cancel,
                    type: NotifyType.warning,
                    title: 'Notify'
                })
                break
            }
            this.token = prompt.token
            const userData = await this.auth() as LoginData | undefined
            if (userData) {
                NOTIFY.push({
                    message: `${lang.welcome} ${chalk.magenta(userData.Viewer.name)}!`,
                    title: chalk.blueBright(lang.auth_successful),
                    type: NotifyType.event
                })
                await fsPromise.writeFile(AniList.tokenpath, prompt.token)
                break
            } else {
                this.token = undefined
                console.log(chalk.redBright(lang.auth_failed))
                if (--attempts <= 0) {
                    NOTIFY.push({
                        type: NotifyType.warning,
                        title: chalk.yellowBright(lang.auth_failed),
                        message: chalk.yellowBright(lang.auth_attempts)
                    })
                }
            }
        }
    }
    private async request<T>(query:string) {
        try{
            const headers = new Headers()
            if(this.token){
                headers.append('Authorization', `Bearer ${this.token}`)
            }
            headers.append('Content-Type', 'application/json')
            headers.append('Accept', 'application/json')
            const res = await fetch(
                this.endPoint, {
                headers,
                method: 'POST',
                body: query
            })
            const resData = <ReqResponse<T>> await res.json()
            if(resData.errors){
                const errors =  resData.errors;
                const noti = Notify.getInstace()
                for(let error of errors){
                    noti.push({
                        type: NotifyType.error,
                        message: error.message,
                        title: 'Anilist Api Request'
                    })
                }
            }
            if(resData?.data){
                return resData.data
            }else {
                return undefined
            }
        }catch{
            return undefined
        }
    }
    async auth(){
        if(fs.existsSync(AniList.tokenpath) && !this.token){
            this.token = await fsPromise.readFile(AniList.tokenpath, {encoding: 'utf-8'})
        }
        if(!this.token){
            return undefined
        }
        const query = Queries.queryViewer()
        return await this.request<LoginData>(query)
    }
    async logout() {
        this.token = undefined
        await fsPromise.rm(AniList.tokenpath)
    }
    async getId(mangaInfo: MangaInfo) {
        const searchQuery = Queries.querySearch(mangaInfo.title, MediaSort.PopularityDesc);
        const res  = <SearchResponse>await this.request(searchQuery)
        if(res?.Page){
            const first = res.Page.media?.[0]
            return first.id
        }else {
            return undefined
        }
    }
    async track(props: TrackProps): Promise<boolean> {
        const query = Queries.mutateTrack(props)
        const res =  await this.request(query)
        if (!res) return false
        return true
    }
}
