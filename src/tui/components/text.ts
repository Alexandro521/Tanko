import  {type RenderContext, type TextOptions, TextRenderable } from "@opentui/core";

export function Text(ctx: RenderContext, content: string, props?: TextOptions){
    const text = new TextRenderable(ctx, {
        ...props,
        content: content,
        width: 'auto',
        minWidth: content.length
    })
    return text
}