import path from "path"
import os from "os"
import type {LaunchOptions} from "playwright"
import gradient from "gradient-string"

export const BASE_DIR = path.resolve(os.homedir(), 'tanko')
export const DOWNLOADS_DEFAULT_DIR = path.resolve(BASE_DIR, 'downloads')
export const DATA_DEFAULT_DIR = path.resolve(BASE_DIR, 'data')
export const TEMP_DIR = os.tmpdir()
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
    // 'network.http.pipelining': true,
  }
}