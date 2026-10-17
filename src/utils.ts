import type { Chapter, Translations, WSZ } from "./types/types.ts";
import path from "path";
import fs from "fs/promises"
import sanitize from "sanitize-filename";
import { stdout } from "node:process";
import type { DateString, DateTimeString, TimeString } from "./types/database.js";
import axios from "axios"
import ansi from 'ansi-escapes'
import pkgInfo from "../package.json" with {type: 'json'}
import { Notify, NotifyType } from "./functions/notify.ts"
import chalk from "chalk"
import supportsHyperlinks from "supports-hyperlinks"

export function timeDiff(time: number) {
  const currentTime = new Date();
  const readTime = new Date();
  currentTime.setTime(Date.now())
  readTime.setTime(time);

  const [currentDay, currentMonth, currentYear] = [
    currentTime.getDay(),
    currentTime.getMonth(),
    currentTime.getFullYear()
  ]
  const [readDay, readMonth, readYear] = [
    readTime.getDay(),
    readTime.getMonth(),
    readTime.getFullYear()
  ]
  const [dayDiff, montDiff, yearDiff] = [
    Math.abs(currentDay - readDay),
    Math.abs(currentMonth - readMonth),
    Math.abs(currentYear - readYear)
  ];
  if (yearDiff >= 1 || montDiff >= 1) {
    return readTime.toDateString()
  } else if (dayDiff >= 7) {
    return `${(dayDiff / 7) | 0} Weeks ago`
  } else if (dayDiff >= 2) {
    return `${dayDiff} Days ago`
  }
  else {
    const hours = readTime.getHours()
    const timePrefix = hours >= 0 && hours < 12 ? "AM" : "PM";
    const timeString = `${hours.toString().padStart(2, "0")}:${readTime.getMinutes().toString().padStart(2, "0")} ${timePrefix}`;
    return `${dayDiff < 1 ? 'Today' : 'Yesterday'} ${timeString}`
  }
}

interface DateInt {
  year: number,
  month: number,
  day: number,
}
interface TimeInt {
  hour: number,
  minute: number,
  second: number
}

const validateTimeFormat = new RegExp(/\+{0,1}(?:\d{4}-\d{2}-\d{2}(?:[\sT]\d{2}:\d{2}(?:\:\d{2}(?:\.\d+)?)?)?|\d{2}:\d{2}(?:\:\d{2}(?:\.\d+)?)?|now|\d{10})/)
const captureDate = new RegExp(/\+{0,1}(\d{4})-(\d{2})-(\d{2})/)
const captureTime = new RegExp(/(\d{2}):(\d{2})(?::(\d{2})(\.\d+)?)?/)

export function timeStringToInt(str: string, utc = true){
  if(validateTimeFormat.test(str)){
  if(str.startsWith('+') || str.startsWith('-')) str = str.slice(1)
  const timeObj = {
    year: 0,
    month: 0,
    day: 0,
    hour: 0,
    minute: 0,
    second: 0,
  }
    if(str === 'now'){
      return timeStringToInt(new Date(Date.now()).toISOString(), utc)
    }
    else if((/\d{10}/).test(str)){
      //multiply by 1000 for scale from seconds unixpoch to milisecond
      const f = new Date((parseInt(str) * 1000))
      return timeStringToInt(f.toISOString(), utc)
    }
    else if(str[10] === ' ' || str[10] === 'T'){
        const cdate = captureDate.exec(str.slice(0,10))
        const ctime = captureTime.exec(str.slice(11))
        timeObj.year =  parseInt(cdate![1])
        timeObj.month =  parseInt(cdate![2])
        timeObj.day =  parseInt(cdate![3])
        timeObj.hour =  parseInt(ctime![1])
        timeObj.minute =  parseInt(ctime![2])
        if(ctime?.[3]){
          const seconds = ctime?.[4] ? parseFloat(ctime[3].concat(ctime[4])) : parseInt(ctime[3])
          timeObj.second = seconds;
        }
    }
    else if(captureDate.test(str.slice(0,10))){
        const cdate = captureDate.exec(str.slice(0,10))
        timeObj.year =  parseInt(cdate![1])
        timeObj.month =  parseInt(cdate![2])
        timeObj.day =  parseInt(cdate![3])
    }else{
      const ctime = captureTime.exec(str)
      timeObj.hour = parseInt(ctime![1])
      timeObj.minute = parseInt(ctime![2])
      if (ctime?.[3]) {
        const seconds = ctime?.[4] ? parseFloat(ctime[3].concat(ctime[4])) : parseInt(ctime[3])
        timeObj.second = seconds;
      }
    }
    return timeObj
  }
  throw new Error('invalid time or date format, see https://sqlite.org/lang_datefunc.html#time_values for valids formats')
}

export function timeSkipFormater(timeDiff: string) {
  const {day,hour,minute,month,second,year} = timeStringToInt(timeDiff)
  const plural = (str:string, n:number)=> n > 1 ? Math.floor(n) + ' ' + str+'s' : 'One ' + str
  if(year > 0){
    return `${plural('Year', year)} ago`
  }
  if(month > 0){
    return `${plural('Month', month)} ago`
  }
  if(day > 0){
    if(day >= 7){
      return `${plural('Week', Math.floor(day/7))} ago`
    }else {
      return `${plural('Day', day)} ago`
    }
  }
  if(hour > 0){
    return `${plural('Hour', hour)} ago`
  }
  if(minute > 0){
    return `${plural('Minute', minute)} ago`
  }
  if(second >= 1){
    return `${plural('Second', second)} ago`
  }else {
    return 'Now'
  }
}

export function sortChapterList(chapters: Chapter[], sort: 'asc' | 'desc' = 'desc'): Chapter[] {
  const handle: (a: Chapter, b: Chapter) => number = sort === 'desc' ?
    (a, b) => {
      return b.number - a.number
    } :
    (a, b) => {
      return a.number - b.number
    }
  const chapterListSort = chapters.sort(handle)
  return chapterListSort
}
export function extractChapterNumber(str: string) {
  const chapterRegex = new RegExp(/\w+\s+(\d+):?/)
  if (chapterRegex.test(str)) {
    const n = chapterRegex.exec(str)?.[1]
    if (typeof n === 'string') {
      return Number(n)
    }
  }
  return undefined
}
export function extractTitleByLang(chapter: Chapter, targetLangIso: Translations) {
  let targetTitle = ''
  const avaliblesTranslations = Object.keys(chapter.translations)
  const hasThisLang = avaliblesTranslations.some((langIso) => langIso === targetLangIso)
  if (hasThisLang) {
    targetTitle = chapter.translations[targetLangIso]?.title as string
  } else {
    targetTitle =
      chapter.translations?.en?.title ??
      //@ts-ignore
      (chapter.translations[avaliblesTranslations[0]]).title
  }
  return targetTitle
}

export async function makeDir(root: string, ...paths: string[]) {
  const sanitizePaths = paths.map(name => sanitize(name))
  const absolutePath = path.join(root, ...sanitizePaths)
  await fs.mkdir(
    absolutePath,
    { recursive: true }
  )
  return absolutePath
}
export function debounce(func: Function, delay: number) {
  let timeoutId: NodeJS.Timeout;
  return async function (...args: any[]) {
    if (timeoutId)
      clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      //@ts-ignore
      func.apply(this, args);
    }, delay);
  };
}
export function centerX(width: number, containerWidth: number, padding = 0) {
  const pos = Math.ceil(containerWidth >> 1) - Math.ceil(width >> 1)
  return Math.max(pos + padding, 0)
}
interface VirtualWindowInput {
  rows: number,
  columns: number,
  cellPxWidth: number,
  cellPxHeigth: number,
  position?: {
    x: number,
    y: number
  }
}
export function virtualWindow(props: VirtualWindowInput): WSZ {
  const rows = Math.min(stdout.rows, props.rows)
  const colums = Math.min(stdout.columns, props.columns)
  const pixelH = rows * (props.cellPxHeigth | 0)
  const pixelW = colums * (props.cellPxWidth | 0)
  const position = {
    x: props.position?.x ?? 0,
    y: props.position?.y ?? 0
  }
  return {
    w_cellPxHeight: props.cellPxHeigth,
    w_cellPxWidth: props.cellPxWidth,
    w_colums: colums,
    w_rows: rows,
    w_height: pixelH,
    w_width: pixelW,
    w_position_x: position.x,
    w_position_y: position.y,
    w_ratio: pixelW / pixelH
  }
}
export function slice(str: string, maxLength: number, padding = 0) {
  if (str.length < maxLength) return str
  return str.slice(0, maxLength - 1 - padding)
}
export function fuzzyMatch(s: string, stringComp: string) {
  const searchPattern = s.trim().toLowerCase();
  const targetString = stringComp.toLowerCase();

  if (targetString.length < searchPattern.length) return 0;

  const patternMap: { [key: string]: number } = {};
  let totalValidChars = 0;

  for (let i = 0; i < searchPattern.length; i++) {
    const char = searchPattern[i];
    if (char !== ' ') {
      patternMap[char] = (patternMap[char] || 0) + 1;
      totalValidChars++;
    }
  }

  if (totalValidChars === 0) return 0;

  const pointPerChar = 100 / totalValidChars;

  let percent = 0;
  const targetMap: { [key: string]: number } = {};

  for (let e = 0; e < targetString.length; e++) {
    const char = targetString[e];

    if (!patternMap[char]) continue;

    targetMap[char] = (targetMap[char] || 0) + 1;

    if (targetMap[char] <= patternMap[char]) {
      percent += pointPerChar;

      if (e > 0 && e < targetString.length - 1) {
        const prevChar = targetString[e - 1];
        const nextChar = targetString[e + 1];

        if (!patternMap[prevChar] && !patternMap[nextChar]) {

          percent = Math.max(percent - (pointPerChar * 0.5), 0);
        }
      }
    }
  }
  const finalPercent = Math.min(Math.round(percent * 100) / 100, 100);
  return finalPercent;
}

export function getRuntimeEnvironment() {
  //@ts-ignore
  if (process.isBun || typeof Bun !== 'undefined') {
    return 'Bun';
  }
  //@ts-ignore
  if (typeof Deno !== 'undefined') {
    //Deno support many modules from nodejs
    return 'Node';
  }
  if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    return 'Node';
  }
  if (typeof importScripts === 'function') {
    return 'Web Worker';
  }
  
  if (typeof window !== 'undefined' && typeof window.document !== 'undefined') {
    return 'Browser';
  }
  return 'Unknown';
}

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
        const notify = Notify.getInstace()

            notify.push({
                title: `Update avalible ${lastVersion}`,
                type: NotifyType.message,
                message
            })
        }
        return false
    } catch (e) {
        if (e instanceof Error) {
            Notify.pushError(e)
        }
    }
}
