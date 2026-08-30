import {
    SelectRenderable,
    type RenderContext,
    type SelectOption,
    type SelectRenderableOptions 
} from "@opentui/core";

interface Props {
    height?: SelectRenderableOptions['height'],
    width?: SelectRenderableOptions['width'],
    maxWidth?: SelectRenderableOptions['maxWidth'],
    options: SelectOption[]
}

export function Select(ctx: RenderContext, props: Props){
    const select = new SelectRenderable(ctx, {
        height: props.height || '100%',
        width: props.width || '100%',
        focusedBackgroundColor: '#252931',
        selectedBackgroundColor: '#263241',
        showSelectionIndicator: true,
        showScrollIndicator: true,
        maxWidth: props.maxWidth || 30,
        options: props.options
    })
    return select
}