import type { Chapter } from "./types/types.js";
import path from "path";
import fs from "fs/promises"
import sanitize from "sanitize-filename";

export function getTimeSkip(time: number) {
  const currentTime = new Date();
  const readTime= new Date();
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
  if(yearDiff >= 1 || montDiff >= 1){
    return readTime.toDateString()
  }else if(dayDiff >= 7){
    return `${(dayDiff/7)| 0} Weeks ago`
  }else if(dayDiff >= 2) {
    return `${dayDiff} Days ago`
  }
  else {
    const hours = readTime.getHours()
    const timePrefix = hours >= 0 && hours < 12 ? "AM" : "PM";
    const timeString = `${hours.toString().padStart(2, "0")}:${readTime.getMinutes().toString().padStart(2, "0")} ${timePrefix}`;
    return `${ dayDiff < 1 ? 'Today' : 'Yesterday'} ${timeString}`
  }
}

export function sortChapterList(chapters: Chapter[], sort: 'asc' | 'desc' = 'desc'): Chapter[] {
  const handle: (a:Chapter,b:Chapter)=>number = sort === 'desc' ? 
  (a, b) => {
    return b.chapter - a.chapter
  } :
  (a, b) => {
    return a.chapter - b.chapter
  }
  const chapterListSort = chapters.sort(handle) 
  return chapterListSort
}
export function extractChapterNumber(str: string){
  const chapterRegex = new RegExp(/\w+\s+(\d+):?/)
  if(chapterRegex.test(str)){
    const n = chapterRegex.exec(str)?.[1]
    if(typeof n === 'string'){
      return Number(n)
    }
  }
  return undefined
}

export async function makeDir(root: string, ...paths: string[]) {
  const sanitizePaths = paths.map(name => sanitize(name))
  const absolutePath =  path.join(root, ...sanitizePaths)
  await fs.mkdir(
    absolutePath,
    {recursive: true}
  )
  return absolutePath
}
