import  {BoxRenderable, TextRenderable, type RenderContext, type SelectOption } from "@opentui/core";
import { MangaDex } from "../../servers/mangadex.ts";
import { Input } from "../components/input.ts";
import { Select } from "../components/select.ts";
import { Text } from "../components/text.ts";

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
                const choices = resList.map((e):SelectOption =>{
                    return {
                        description: '',
                        name: e.title,
                        value: e
                    }
                })
                resultList.options = choices
            }catch(e){

            }
        },
    })
    const resultList = Select(ctx, {
        maxWidth: '100%',
        options: [
            {
                name: 'results',
                description: '',
                value: ''
            }
        ]
    })
    const resultsHeader = new BoxRenderable(ctx, {
        width: '100%',
        height: 2,
        flexDirection: 'row'
    })
    const filterInput = Input(ctx, {
        borders: false,
        labelText: 'filter: ',
        })
    const resultsText = Text(ctx, 'Results: 0 provider: Mangadex',  {fg: '#9e9a9a', marginLeft: 1})

    resultsHeader.add(resultsText)
    resultsHeader.add(filterInput)
    mainContainer.add(searchBar)
    mainContainer.add(resultsHeader)
    mainContainer.add(resultList)
    body.add(mainContainer)
    body.add(infoContainer)
    return body
}