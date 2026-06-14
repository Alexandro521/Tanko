import axios from "axios"
import ansi from 'ansi-escapes'
import pkgInfo from "../package.json" with {type: 'json'}
import { Notify, NotifyType } from "./functions/notify.js"
import chalk from "chalk"
const notify = Notify.getInstace()


export async function versionVerify(){
    try{
    const res = await axios.get('https://registry.npmjs.org/tanko')
    const versions = Object.keys(res.data.versions)
    const lastVersion = versions[versions.length -1]
    if(pkgInfo.version !== lastVersion){
        const message = `
A new version of Tanko is available!
${chalk.redBright(pkgInfo.version)} 🠆 ${chalk.greenBright(lastVersion)}
Run: ${chalk.blueBright('$pnpm add -g tanko')} to update to the latest version and enjoy the new features.

Go to ${ansi.link(chalk.underline.blueBright('releases'), 'https://github.com/Alexandro521/Tanko/releases')} to view the release notes`
notify.push({
    title: `Update avalible ${lastVersion}`,
    type: NotifyType.message,
    message
})
}
return false
    }catch(e){
        if(e instanceof Error){
            notify.push({
                title: e.name,
                type: NotifyType.error,
                message: e.message
            })
        }
    }
}
