import {
    SelectRenderable,
    InputRenderable,
    SelectRenderableEvents,
    type RenderContext,
    type SelectRenderableOptions,
    type SelectOption,
    BoxRenderable,
    TextRenderable
} from "@opentui/core";
import { Text } from "./text.ts";
import { Input } from "./input.ts";
import { debounce } from "../../utils.ts";

interface Props<T> extends SelectRenderableOptions {
    onSelect?: (index: number, choice: Options<T>) => void
    onChange?: (index: number, choice: Options<T>) => void
}
export interface Options<T> extends SelectOption {
    value: T
}
export class Select<T> extends BoxRenderable{
    select!: SelectRenderable
    label!: TextRenderable
    constructor(ctx: RenderContext, props: Props<T>) {
        super(ctx, {
            width: '100%',
            height: '100%',
            flexDirection: 'column'
        })
        const header = new BoxRenderable(ctx, {
            width: '100%',
            height: 2,
            flexDirection: 'row'
        })
        const filterInput = Input(ctx, {
            borders: false,
            labelText: 'filter: ',
            onInput: (() => {
                filterDobunce()
            })
        })
        this.select = new SelectRenderable(ctx, {
            id: 'select',
            height: props.height || '100%',
            width: props.width || '100%',
            focusedBackgroundColor: '#252931',
            selectedBackgroundColor: '#263241',
            showSelectionIndicator: true,
            showScrollIndicator: true,
            maxWidth: props.maxWidth || 30,
            options: props.options,
            onKeyDown: (key) => {
                if (
                    key.name !== 'up' &&
                    key.name !== 'down' &&
                    key.name !== 'escape') {
                    /** pass first de key value */
                    const childrens = filterInput.getChildren()
                    if (
                        key.name !== 'backspace' &&
                        key.name !== 'left' &&
                        key.name !== 'right'
                    ) {
                        for (const child of childrens) {
                            if (child instanceof InputRenderable) {
                                child.value += (key.sequence)
                            }
                        }
                    }
                    filterInput.focus()
                }
                if (props.onKeyDown) {
                    props.onKeyDown(key)
                }
            }
        })
        this.label = Text(ctx, `Results: ${this.select.options.length} - provider Mangadex -`, { fg: '#9e9a9a', marginLeft: 1 })
        const filterDobunce = debounce(() => {
            this.select.focus()
        }, 1000)
        if (props.onSelect) {
            this.select.on(SelectRenderableEvents.ITEM_SELECTED, props.onSelect)
        }
        if (props.onChange) {
            this.select.on(SelectRenderableEvents.SELECTION_CHANGED, props.onChange)
        }
        header.add(this.label)
        header.add(filterInput)
        this.add(header)
        this.add(this.select)
    }
    set options(options: Options<T>[]){
        this.select.options = options
        this.label.content = `Results: ${options.length} - provider Mangadex -`
        this.label.width = this.label.textLength
    }
    get options(): Options<T>[] {
        return this.select.options as Options<T>[]
    }
    focus(): void {
        this.select.focus()
    }
}