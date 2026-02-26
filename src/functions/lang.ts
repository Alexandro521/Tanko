import { readFileSync } from 'fs';
import type { LangInterface } from "@/types/lang.js";

// Usamos el sistema de archivos de Node
const loadJson = (path: string) => 
    JSON.parse(readFileSync(new URL(path, import.meta.url).pathname, 'utf-8'));

const es = loadJson("../lang/es.json") as LangInterface;
const en = loadJson("../lang/en.json") as LangInterface;

export const lang: {[key:string]: LangInterface} = {
    es,
    en
} as const;