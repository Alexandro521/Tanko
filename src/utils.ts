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

export function sortChapterList(chapters: Chapter[]): Chapter[] {
  const ChapterSortRegex = new RegExp(/\w+\s+(\d+):?/)
  const chapterListSort = chapters.sort((a, b) => {
    return Number(ChapterSortRegex.exec(b.title)?.[1] ?? 0) - Number(ChapterSortRegex.exec(a.title)?.[1] ?? 0)
  })
  return chapterListSort
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
