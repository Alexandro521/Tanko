import type { MangaServerInterface,  Chapter,  ChapterInfo,  LastedManga,  PopularManga,  SearchResult } from "../types/types.js";
import axios from "axios";

export class MangaDex implements MangaServerInterface{
    baseUrl = 'https://api.mangadex.org'
    
    search(query: string): Promise<SearchResult[]> {
        throw new Error("Method not implemented.")
    }
    getChaptersList(mangaSrc: string): Promise<{ title: string; chapters: Chapter[]; } | undefined> {
        throw new Error("Method not implemented.");
    }
    getChapterPages(chapterSrc: string): Promise<ChapterInfo> {
        throw new Error("Method not implemented.");
    }
    getPopulars(): Promise<PopularManga[] | undefined> {
        throw new Error("Method not implemented.");
    }
    getLastMangas(): Promise<LastedManga[] | undefined> {
        throw new Error("Method not implemented.");
    }

}

