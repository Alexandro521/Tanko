import { BoxRenderable, ASCIIFontRenderable, SelectRenderable, type RenderContext, type VNode } from "@opentui/core";
import { Select } from "../components/select.ts";

export function Main(ctx: RenderContext): BoxRenderable{    
    const body = new BoxRenderable(ctx, {
        width: '100%',
        height: '100%'
    })
    const title = new ASCIIFontRenderable(ctx, {
        text: 'tanko',
        font: 'tiny',
        marginTop: 1
    })
    
    const menuContainer = new BoxRenderable(ctx, {
        flexGrow: 2,
        height: '100%',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 1
    })
   /* const select = Select(ctx, {
        options: [
            {
                name: 'search',
                description: '',
                value: 'goto search'
            },
                        {
                name: 'most popular',
                description: '',
                value: 'goto search'
            },
                        {
                name: 'most recent',
                description: '',
                value: 'goto search'
            },
                        {
                name: 'History',
                description: '',
                value: 'goto search'
            },
                        {
                name: 'Configuration',
                description: '',
                value: 'goto search'
            },
                        {
                name: 'Exit',
                description: '',
                value: 'goto search'
            }
        ]
    });*/
    menuContainer.add(title)
   /* menuContainer.add(select)*/
    body.add(menuContainer)
    return body
}