import { createCliRenderer, BoxRenderable } from "@opentui/core"
import { Main } from "./pages/main.ts"
import { Search } from "./pages/search.ts"
import { TerminalControl } from "../functions/reader.ts"

await TerminalControl.getWindowDimension()

const renderer = await createCliRenderer({
    exitOnCtrlC: true,
    screenMode: 'alternate-screen',
    externalOutputMode: 'passthrough'
})

export const WINDOW = new BoxRenderable(renderer, {
    id: 'window',
    width: "100%",
    height: "100%",
    backgroundColor: "#252931",
    flexDirection: "column",
})
WINDOW.add(Search(renderer))


renderer.root.add(WINDOW)