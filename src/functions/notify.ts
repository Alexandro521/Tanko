import type{Options} from "boxen";
import boxen from "boxen";
import ansi from 'ansi-escapes'
import { EventEmitter } from "node:events";
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
    private strbox: undefined | string = undefined
    private popTimeout: NodeJS.Timeout | null = null
    private boxProps = {
        x_pos: 0,
        width: 0,
        height: 0,
    }
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
        this.strbox = undefined
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
    getf():string | undefined {
        const notify = this.get()
        if(!notify) return undefined
        let color: Colors = 'gray'
        const width =Math.min(120, Math.max(notify.message.length, 80))
        const options:Options ={
            title: notify.title,
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
        const str = boxen(notify.message, options)
        const lines = str.split('\n')
        this.strbox = str
        this.boxProps = {
            x_pos: 1,
            width: width,
            height: lines.length
        }
        return str
    }
    render(){
        let s = this.strbox
        if(!s){
            s = this.getf()
            if(!s) {
                process.stdout.write('\x1B[0J')
                return
            }
        }
        const quitText = `(^Q) Quit     ${this.stackIndex} Left`
        //before clear from the cursor pos to the end screen
        process.stdout.write('\x1B[0J'+ s)
        process.stdout.write(
            ansi.cursorSavePosition +
            '\r' +
            ansi.cursorUp(1) + 
            ansi.cursorForward(Math.abs(this.boxProps.width - quitText.length -2)) +
            quitText +
            ansi.cursorRestorePosition +
            ansi.cursorUp(this.boxProps.height -1)
        )
    } 
    clear(): void{

    }
}
/*
const instance = Notify.getInstace()

instance.push({
    message: 'hello world this is a messagdf\nfffffffffffff fffffe dfdfsdf',
    title: 'test notify',
    type: NotifyType.message
})
instance.render();*/