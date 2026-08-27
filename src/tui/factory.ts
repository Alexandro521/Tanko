
import { MangaDex } from "../servers/mangadex.ts"

import {
    createCliRenderer,
    BoxRenderable,
    InputRenderable,
    ASCIIFontRenderable,
    SelectRenderable,
    type SelectOption,
    SelectRenderableEvents,
    InputRenderableEvents,
    KeyEvent
} from "@opentui/core"

export const renderer = await createCliRenderer({
    consoleMode: 'console-overlay',
    exitOnCtrlC: true,
    maxFps: 12,
    screenMode: 'alternate-screen',
    useMouse: true,
    autoFocus: true,
})
export const WINDOW = new BoxRenderable(renderer, {
    id: 'window',
    width: "100%",
    height: "100%",
    backgroundColor: "#252931",
    flexDirection: "column",
})
const tankoTitle = () => new ASCIIFontRenderable(renderer, {
    id: 'h1',
    text: 'Tanko',
    font: 'tiny',
    color: '#c375e2fd',
    marginTop: 0
})
type ElementSize = number | 'auto' | `${number}%`

interface SelectOptions {
    width?: ElementSize,
    height?: ElementSize,
    onSelect?: (index: number, option: SelectOption)=>void
    onChanged?: (index: number, option: SelectOption | null)=>void
}

export function makeSelect(id: string, options: SelectOption[], attr: SelectOptions | undefined = undefined ) {
    const select = new SelectRenderable(renderer, {
    id,
    marginTop: 1,
    width: attr?.width || '100%',
    height: attr?.height || '100%',
    focusedBackgroundColor: '#252931',
    backgroundColor: '#252931',
    selectedBackgroundColor: "#a2a2ea44",
    selectedTextColor: "#da8af5",
    textColor: "#AAAAAA",
    descriptionColor: "#666666",
    options
    })
    select.on(SelectRenderableEvents.ITEM_SELECTED, (index: number, option: SelectOption)=>{
        if(typeof attr?.onSelect === 'function' ){
            attr.onSelect(index, option)
        }
    })
    select.on(SelectRenderableEvents.SELECTION_CHANGED, (index: number, option: SelectOption | null)=>{
        if(typeof attr?.onChanged === 'function' ){
            attr.onChanged(index, option)
        }
    })
    return select
}
export async function mainSection(){
    const mainContainer = new BoxRenderable(renderer, {
        id: 'main',
        width: "100%",
        height: '100%',
        minWidth: 20,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start'
    })
    return new Promise((resolve)=>{
        const select = makeSelect('main-select', 
            [
                {
                name: 'search',
                description: 'clear',
                value: 's'
            },
            {
                name: 'search',
                description: 'clear',
                value: 's'
            }
        ],
        {
            width: 35,
            onSelect: (_, option)=>{
                mainContainer.destroyRecursively()
                resolve(option)
            }
        }
    )
    mainContainer.add(tankoTitle())
    mainContainer.add(select)
    WINDOW.add(mainContainer)
    select.focus()
})
}
interface InputOptions {
    width?: ElementSize,
    height?: ElementSize,
    onChange?: (value: string)=>void
    onInput?: (value: string)=>void
    onEnter?: (value: string)=>void
}
function makeInput(attr: InputOptions | undefined = undefined){
    const input = new InputRenderable(renderer,
        {
            id: 't',
            width: '100%',
            placeholder: 'one piece, vagabond ...',
            placeholderColor: '#AAAAAA',
        }
    )
    const box = new BoxRenderable(renderer, {
        id: 'box',
        flexGrow: 1,
        height: 3,
        borderStyle: 'single',
    })
    if(typeof attr?.onEnter === 'function')
        input.on(InputRenderableEvents.ENTER, attr.onEnter)
    if(typeof attr?.onInput === 'function')
        input.on(InputRenderableEvents.INPUT, attr.onInput)
    if(typeof attr?.onChange === 'function')
        input.on(InputRenderableEvents.CHANGE, attr.onChange)
    
    input.focus()
    box.add(input)
    return box
}

export async function searchSection() {
    return new Promise(resolve => {
        const server = new MangaDex()
        const header = new BoxRenderable(renderer, {
            id: 'main',
            width: process.stdout.columns,
            height: 3,
            minWidth: 20,
            alignSelf: 'flex-start',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'flex-start'
        })
        const bar = makeInput({
            onEnter: async (v)=>{
                const results = await server.search(v)
                const options = results.map((e): SelectOption =>{
                    return {
                        name: e.title,
                        description: e.lastUploadChapterSrc || '',
                        value: e
                    }
                })
                select.options = options
                select.focus()
            }
        })
        
        const section = new BoxRenderable(renderer, {
            marginTop: 0, 
            width: '100%',
            height: '100%',
            flexDirection: 'row'
        })
        const leftSide = new BoxRenderable(renderer, {
            width: '50%',
            height: '100%'
        })
        const righSide = new BoxRenderable(renderer, {
            width: '50%',
            height: '100%',
            border: true,
            borderStyle: 'rounded'
        })
        const select = makeSelect('options', [{name: 'search...',description: 'dasas\nsdsad\nsasdsa', value: 'asdas\n'}])

        leftSide.add(select)

        bar.focus()
        header.add(bar)
     //   header.add(tankoTitle())
        section.add(leftSide)
        section.add(righSide)
        WINDOW.add(header)
        WINDOW.add(section)
    })
}

renderer.root.add(WINDOW)
