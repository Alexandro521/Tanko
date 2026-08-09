import type { Chapter, WSZ } from "./types/types.js";
import path from "path";
import fs from "fs/promises"
import sanitize from "sanitize-filename";
import { stdout } from "node:process";

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
export function debounce(func: Function, delay: number) {
  let timeoutId: NodeJS.Timeout;
  return async function (...args:any[]) {
    if(timeoutId)
      clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      //@ts-ignore
      func.apply(this, args);
    }, delay);
  };
}
export function centerX(width: number, containerWidth: number, padding = 0){
  const pos = Math.ceil(containerWidth >> 1) - Math.ceil(width >> 1)
  return Math.max(pos+padding, 0)
}
interface VirtualWindowInput{
  rows: number,
  columns: number,
  cellPxWidth: number,
  cellPxHeigth: number,
  position?: {
    x: number,
    y: number
  }
}
export function virtualWindow(props: VirtualWindowInput): WSZ{
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
export function slice(str: string, maxLength: number, padding = 0){
  if(str.length < maxLength ) return str
  return str.slice(0, maxLength -1 - padding)
}
