import  {BoxRenderable, InputRenderable, KeyEvent, SelectRenderable, TextRenderable, type RenderContext, type SelectOption } from "@opentui/core";
import { MangaDex } from "../../servers/mangadex.ts";
import { Input } from "../components/input.ts";
import { Select, type Options } from "../components/select.ts";
import { Text } from "../components/text.ts";
import { debounce } from "../../utils.ts";
import type { MangaInfo } from "../../types/types.js";

export function Search(ctx: RenderContext){
    const mangaDex = new MangaDex()
    const body = new BoxRenderable(ctx, {
        id: 'search-section', 
        width: '100%', 
        height: '100%',
        flexDirection: 'row'
    })
    const mainContainer = new BoxRenderable(ctx, {
        id: 'search-left-side',
        flexGrow: 2, 
        height: '100%',
        flexDirection: 'column'
    })
    const infoContainer = new BoxRenderable(ctx,    {
        id: 'search-righ-side',
        flexGrow: 1,
        minWidth: '35%',
        height: '100%',
        border: true,
        borderStyle: 'rounded',
        borderColor: '#b685e0aa',
    })
    const searchBar = Input(ctx, {
        labelText: 'Search: ', 
        placeholder: 'vagabond, dadadan, mayonaka heart tune...',
        async onSubmit(v) {
            try{
                const resList = await mangaDex.search(v)
                const choices = resList.map((e):Options<MangaInfo> =>{
                    return {
                        description: '',
                        name: e.title,
                        value: e
                    }
                })
                Results.options = choices
                Results.focus()
            }catch(e){
            }
        },
    })
    const Results = new Select<MangaInfo>(ctx, {
        maxWidth: '100%',
        onKeyDown(key) {
            if(key.name === 'escape'){
                searchBar.focus()
            }
        },

        options: new Array(15).fill(0).map((_, i) => {
            return {
                name: `Chapter ${15 - i}`,
                description: 'decription',
                value: `Chapter ${15 - i}`
            }
        })
    })

    mainContainer.add(searchBar)
    mainContainer.add(Results)
    body.add(mainContainer)
    body.add(infoContainer)
    searchBar.focus() 
    return body
}