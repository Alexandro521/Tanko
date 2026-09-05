import type{Options} from "boxen";
import boxen from "boxen";
import ansi from 'ansi-escapes'
import { EventEmitter } from "node:events";
import chalk from "chalk";
import supportsHyperlinks from "supports-hyperlinks";
import { ISSUES_REPO } from "../const.ts";
type Colors = Options['borderColor']

export enum NotifyType {
    error = 2321,
    message = 4123,
    warning = 2141,
    update = 2321,
    event = 1341
}

export interface NotifyProps {
    type: NotifyType,
    title: string,
    message: string,
    lifetime?: number,
}



export class Notify extends EventEmitter{
    private static instance: Notify
    private stackSize = 64
    private stackIndex = 0;
    private stack: NotifyProps[] = new Array(this.stackSize).fill(null)
    private popTimeout: NodeJS.Timeout | null = null

    private constructor () {
        super()
    }
    public static getInstace(){
        if(!this.instance)
            this.instance = new Notify;
        return this.instance
    }
    private timer(){
        this.popTimeout = null
        this.pop()
        this.emit('pop')
    }
    push(notify: NotifyProps): void{
        if(this.stackIndex < this.stackSize){
            this.stack[this.stackIndex++] = notify;
            if(this.popTimeout){
            //    clearTimeout(this.popTimeout)
            }
          //  this.popTimeout = setTimeout(this.timer, 2000)
        }else {
            this.pop()
            this.push(notify)
        }
    }
    pop(): NotifyProps | undefined {
        if(this.stackIndex > 0){
            if(this.popTimeout) {
              //  clearTimeout(this.popTimeout)
            }
          //  this.popTimeout = setTimeout(this.timer, 2000)
            return this.stack[this.stackIndex--]
        }
        return undefined
    }
    get(): NotifyProps | undefined{
        if(this.stackIndex > 0){
            return this.stack[this.stackIndex -1]
        }
        return undefined
    }
    getf() {
        const props = this.get()
        if(!props) return undefined
        let message = props.message
        let color: Colors = 'gray'
        //min 80, max 120
        const width =Math.min(120, Math.max(props.message.length, 80), process.stdout.columns -2)
        switch(props.type){
            case NotifyType.error:
                color = 'redBright'
                const issueLink = supportsHyperlinks.stdout ? ansi.link("Tanko issues" ,ISSUES_REPO) : ISSUES_REPO
                message += (
                    `\n\n open an issue ${chalk.underline(chalk.magenta(issueLink))}`
                )
                break
            case NotifyType.message: 
                color = 'gray'
                break
            case NotifyType.event:
                color = 'blueBright'
                break
            case NotifyType.warning:
                color = 'yellowBright'
                break
        }
        const options:Options ={
            title: props.title,
            textAlignment: 'center',
            titleAlignment: 'left',
            borderStyle: 'single',
            dimBorder: false,
            width,
            borderColor: color,
            margin: {
                bottom:0,
                left: 1,
                right: 1,
                top: 2
            },
            padding: {
                bottom: 2,
                left: 2,
                right: 2,
                top: 1
            },
        }
        const str = boxen(message, options)
        const lines = str.split('\n')
        return {
            strBox: str,
            x_pos: 1,
            width: width,
            height: lines.length
        }
    }
    render(){
        const box = this.getf()
        if(!box) return
        const quitText = chalk.bgGray(' ^Q ') + 'quit ' + `${this.stackIndex > 1 ?['⏺', this.stackIndex, 'Left'].join(' ') : ''}`

        process.stdout.write('\x1B[0J'+ box?.strBox)
        process.stdout.write(
            ansi.cursorSavePosition + '\r' +
            ansi.cursorUp(1) + 
            ansi.cursorForward(Math.abs(box.width - quitText.length -2)) +
            quitText +
            ansi.cursorRestorePosition +
            ansi.cursorUp(box.height -1)
        )
    } 
    clear(): void{
        this.stackIndex = 0
    }
    static pushError(err: Error) {
        const notify = Notify.getInstace()
        if (err instanceof Error) {
            const props: NotifyProps = {
                type: NotifyType.error,
                message: err.message,
                title: err.name,
            }
            notify.push(props)
        }
    }
    static pushMessage(message: string, title = '') {
        const notify = Notify.getInstace()
            const props: NotifyProps = {
                type: NotifyType.message,
                message,
                title,
            }
            notify.push(props)
        }
}