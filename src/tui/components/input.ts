import  {
    TextRenderable,
    BoxRenderable,
    InputRenderable,
    InputRenderableEvents,
    type RenderContext, 
    Renderable
} from "@opentui/core"

const borderColors = ['#b685e0aa', '#c896f5' ]
const labelColors = ['#AAAA', '#FFFF']
interface Props {
    borders?: boolean
    labelText?:string
    placeholder?: string
    onSubmit?: (v:string)=>void
    onInput?: (v:string)=>void
    onChange?: (v:string)=>void
}
export function Input(ctx: RenderContext,props: Props){

    const container = new BoxRenderable(ctx, {
        id: 'search-bar',
        flexDirection: 'row',
        width: '100%',
        paddingLeft: 1,
        focusable: true,
        height: props?.borders === false ? 1 : 3, 
        ... (props.borders === undefined ||props.borders && props.borders ===  true) ? 
        ({ 
        border: props?.borders ? props.borders : true, 
        borderStyle: 'rounded',
        borderColor: borderColors[0],
        focusedBorderColor:  borderColors[1],
        onMouseOver() {
            container.borderColor = borderColors[1]
        },
        onMouseOut(){
            container.borderColor = borderColors[0]
        }
        }) : {}
    })
    const label = new TextRenderable(ctx, {
        content: props.labelText,
        fg: labelColors[0],
        width: props.labelText ? props.labelText.length : 1
    })
    const input = new InputRenderable(ctx, {
        width: '100%',
        placeholder: props.placeholder
    })
    if (props.onSubmit) {
        input.on(InputRenderableEvents.ENTER, props.onSubmit)
    }
    if (props.onInput) {
        input.on(InputRenderableEvents.INPUT, props.onInput)
    } 
    if (props.onChange) {
        input.on(InputRenderableEvents.CHANGE, props.onChange)
    }
    container.add(label)
    container.add(input)
    return container
}