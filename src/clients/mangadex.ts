import { MangaServerInterface, type Chapter, type ChapterInfo, type LastedManga, type PopularManga, type SearchResult } from "@/types/types.js";
import axios from "axios";

export class MangaDex implements MangaServerInterface{
    baseUrl = 'https://api.mangadex.org'
    
  async  search(query: string): Promise<SearchResult[]> {

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

