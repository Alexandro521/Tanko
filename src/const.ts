import path from "path"
import os from "os"
import ansi from 'ansi-escapes'
import type {BrowserContextOptions, LaunchOptions} from "playwright"
import gradient from "gradient-string"
import chalk, { Chalk } from "chalk"

export const BASE_DIR = path.resolve(os.homedir(), 'tanko')
export const DOWNLOADS_DEFAULT_DIR = path.resolve(BASE_DIR, 'downloads')
export const CONFIG_FILE_PATH = path.resolve(BASE_DIR, 'config_v2.json')
export const DATA_DEFAULT_DIR = path.resolve(BASE_DIR, 'data')
export const HISTORY_PATH = path.resolve(DATA_DEFAULT_DIR, 'read_history_v2.json')
export const TEMP_DIR = os.tmpdir()
export const BROWSER_STORAGE_PATH = path.resolve(DATA_DEFAULT_DIR, 'browser')
export const BROWSER_STORAGE_FILE = path.resolve(BROWSER_STORAGE_PATH, 'storage.json')

export const PRIMARY_COLOR = '#bf78fa'

export const WELCOME_MESSAGE = gradient('#84b7fa', PRIMARY_COLOR).multiline(`
  ████████╗ █████╗ ███╗   ██╗██╗  ██╗ ██████╗ 
  ╚══██╔══╝██╔══██╗████╗  ██║██║ ██╔╝██╔═══██╗
     ██║   ███████║██╔██╗ ██║█████╔╝ ██║   ██║
     ██║   ██╔══██║██║╚██╗██║██╔═██╗ ██║   ██║
     ██║   ██║  ██║██║ ╚████║██║  ██╗╚██████╔╝
     ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝ ╚═════╝ 
`)
export const LAUNCH_OPTIONS:LaunchOptions = {
    headless: true,
    args: [
        '--headless',
        '--no-sandbox', 
        '--disable-gpu'
    ],
    firefoxUserPrefs: {
    'permissions.default.image': 2,
    'toolkit.cosmeticAnimations.enabled': false,
    'browser.sessionhistory.max_entries': 1,
    'browser.cache.disk.enable': false,
    'app.update.auto': false,
    'dom.ipc.processCount': 1,
    'datareporting.policy.dataSubmissionEnabled': false,
    'toolkit.telemetry.enabled': false,
    'javascript.options.ion': true, 
    'javascript.options.baselinejit': true,
    'security.OCSP.enabled': 0,
    'network.dns.disablePrefetch': true,
    'layout.css.report_errors': false,
    'browser.tabs.remote.autostart': true,
    'layers.acceleration.disabled': true,
    'browser.frames.enabled': false,
    'permissions.default.desktop-notification': 2,
    'network.http.proxy.pipelining': true,
    'network.http.max-connections': 64,
  }
}
export const BROWSER_CONTEXT_OPTIONS:BrowserContextOptions = {
  javaScriptEnabled: true,
  reducedMotion: 'reduce',
}

export const FIRST_INIT_MESSAGE = `
Welcome to Tanko! It's been several months since I last updated this tool,
but I've been working hard to release an update that lives up to my absence.
This is just a small preview of my progress. Thanks for using Tanko!

If you find any errors, it would help me a lot if you opened an ${ansi.link(chalk.underline.blueBright('issue'), 'https://github.com/Alexandro521/Tanko/issues')} in the GitHub repository.

P.S.: Press Ctrl+Q to close this message`