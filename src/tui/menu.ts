import { BoxRenderable } from "@opentui/core"
import { mainSection, searchSection } from "./factory.ts"

async function master(){
    while(true){
     //   const option = await mainSection()
        const search = await searchSection()
    }

}

master()