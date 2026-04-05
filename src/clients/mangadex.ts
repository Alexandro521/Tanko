import type { ChapterListMangadex } from "src/types/mangadex/get_chapters.js";
import type { MangaServerInterface,  Chapter,  ChapterInfo,  LastedManga,  PopularManga,  SearchResult, ChapterPage, ChapterLangKey } from "../types/types.js";
import axios from "axios";

import type { SearchResultMangadex } from "src/types/mangadex/search.js";
import type { Puzzle } from "src/types/mangadex/get_pages.js";


export class MangaDex implements MangaServerInterface{
    private  baseUrl = 'https://api.mangadex.org'

    async search(query: string): Promise<SearchResult[] | undefined> {
        try{
                const {data} = await axios.get<SearchResultMangadex>(`${this.baseUrl}/manga`, {
                params: {
                    "title": query,
                }
            })
    
        return data.data.map((e): SearchResult =>{
                return {
                    thumbnail: "",
                    label: e.attributes.title.en ?? e.attributes.title["ja-ro"] ?? '',
                    link:e.id,
                    value : e.attributes.title.en ?? '' 
                }
            })
        } catch{
            console.log('Error ')
        }
    }
    async getChaptersList(mangaSrc: string): Promise<{ title: string; chapters: Chapter[]; } | undefined> {
        try{ 
            const res = await axios.get<ChapterListMangadex>(
                `${this.baseUrl}/manga/${mangaSrc}/feed?limit=256`
            );

            const chapterMap = new Map<string, number>()

            const chapterList: Chapter[] = []

            for(const chapterData of res.data.data){
                const chapterNumber = chapterData.attributes.chapter ?? ''
                const chapterLang = chapterData.attributes.translatedLanguage as ChapterLangKey
                const title = `Chapter ${chapterData.attributes.chapter}${chapterData.attributes.title ? ': ' + chapterData.attributes.title : ''}`
                if(chapterMap.has(chapterNumber)){
                    const target = chapterList[chapterMap.get(chapterNumber) ?? 0 ];
                    target.lang_n++

                    target.src[chapterLang] = {
                        lang: chapterLang,
                        title,
                        src: chapterData.id
                    }
                    continue
                }

                const chapterInfo:Chapter = {
                    id: chapterData.id,
                    index: chapterNumber,
                    title: `Chapter ${chapterData.attributes.chapter}${chapterData.attributes.title ? ': ' + chapterData.attributes.title : ''}`,
                    lang_n: 1,
                    src: {},
                }
                chapterInfo.src[chapterLang] = {
                    lang: chapterLang,
                    title: `Chapter ${chapterData.attributes.chapter}${chapterData.attributes.title ? ': ' + chapterData.attributes.title : ''}`,
                    src: chapterData.id
                }
                chapterList.push(chapterInfo)
                chapterMap.set(chapterNumber, chapterList.length -1)
            }
            chapterList.sort((a,b) =>  Number(b.index ) - Number(a.index))
            return {
                title: res.data.data[0].attributes.title ?? '',
                chapters: chapterList 
            }
            
        }catch(e){
            console.log('Error ')
        }
    }

    async getChapterPages(chapterSrc: string): Promise<ChapterInfo | undefined> {
        try{
            let chapterInfo: ChapterInfo;
            //chapter attributes
            //chapter pages 
            const res = await axios.get<Puzzle>(`${this.baseUrl}/at-home/server/${chapterSrc}`)
            console.log(res.data)
            let {baseUrl, chapter} = res.data
            baseUrl += `/data/${chapter.hash}/`

            return  {
                main_src: '',
                mangaTitle: '',
                nextChapter: '', 
                prevChapter: '',
                src: '',
                title: '',
                pages: chapter.data.map((e,i):ChapterPage=> {
                    return {page_index: i.toString(), src: `${baseUrl}${e}`}
                })
            }

        }catch(e){
            
        }
    }
    getPopulars(): Promise<PopularManga[] | undefined> {
        throw new Error("Method not implemented.");
    }
    getLastMangas(): Promise<LastedManga[] | undefined> {
        throw new Error("Method not implemented.");
    }

}
