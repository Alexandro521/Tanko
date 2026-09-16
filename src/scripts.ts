import axios from "axios"
import ansi from 'ansi-escapes'
import pkgInfo from "../package.json" with {type: 'json'}
import { Notify, NotifyType } from "./functions/notify.ts"
import chalk from "chalk"
import supportsHyperlinks from "supports-hyperlinks"
const notify = Notify.getInstace()

export async function versionChecker() {
    try {
        const res = await axios.get('https://registry.npmjs.org/tanko')
        const versions = Object.keys(res.data.versions)
        const lastVersion = versions[versions.length - 1]
        const releaseUrl = 'https://github.com/Alexandro521/Tanko/releases'
        const link = supportsHyperlinks.stdout ? ansi.link(chalk.underline.blueBright('releases'), releaseUrl) : chalk.underline.blueBright(releaseUrl)
        if (pkgInfo.version !== lastVersion) {
            const message = `
A new version of Tanko is available!
${chalk.redBright(pkgInfo.version)} ${chalk.blueBright('→')} ${chalk.greenBright(lastVersion)}
Run: ${chalk.blueBright('$pnpm add -g tanko')} to update to the latest version and enjoy the new features.

Go to ${link} to view the release notes`
            notify.push({
                title: `Update avalible ${lastVersion}`,
                type: NotifyType.message,
                message
            })
        }
        return false
    } catch (e) {
        if (e instanceof Error) {
            notify.push({
                title: e.name,
                type: NotifyType.error,
                message: e.message
            })
        }
    }
}
