import type { ChapterListMangadex } from "src/types/mangadex/get_chapters.js";
import type { MangaServerInterface,  Chapter,  ChapterInfo,  LastedManga,  PopularManga,  SearchResult, ChapterPage, ChapterLangKey, ClientsName } from "../types/types.js";
import axios from "axios";

import type { SearchResultMangadex } from "src/types/mangadex/search.js";
import type { Puzzle } from "src/types/mangadex/get_pages.js";

export class MangaDex implements MangaServerInterface{
    public name:ClientsName = "mangadex"
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
            let offset = 0
            let data = [];
            while(true){
                const res = await axios.get<ChapterListMangadex>(
                    `${this.baseUrl}/manga/${mangaSrc}/feed?limit=300&offset=${offset}`
                );
                data.push(...res.data.data);
                if(data.length >= res.data.total) 
                    break;
                offset += Math.min(300, res.data.total - data.length);
            }

            const chapterMap = new Map<string, number>()
            interface Chapter_ extends Chapter {index: number | string}

            const chapterList: Chapter_[] = []

            for(const chapterData of data){
                const chapterNumber = chapterData.attributes.chapter ?? ''
                const chapterLang = chapterData.attributes.translatedLanguage as ChapterLangKey
                const title = 
                `Chapter ${chapterData.attributes.chapter}`+
                `${chapterData.attributes.title != null ? ': ' + chapterData.attributes.title : ''}`

                if(chapterMap.has(chapterNumber)){
                    
                    const target = chapterList[chapterMap.get(chapterNumber) ?? 0 ];
                    target.lang_n++

                    target.src[chapterLang] = {
                        title,
                        lang: chapterLang,
                        src: chapterData.id
                    }
                    continue
                }

                const chapterInfo:Chapter_ = {
                    title,
                    lang_n: 1,
                    src: {},
                    id: chapterData.id,
                    index: chapterNumber,
                }

                chapterInfo.src[chapterLang] = {
                    title,
                    lang: chapterLang,
                    src: chapterData.id
                }
                chapterList.push(chapterInfo)
                chapterMap.set(chapterNumber, chapterList.length -1)
            }

            chapterList.sort((a,b) =>  Number(b.index) - Number(a.index))
            return {
                title: chapterList[0]?.title ?? '',
                chapters: chapterList 
            }

        }catch(e){
            console.log('Error ')
        }
    }

    async getChapterPages(chapterSrc: string): Promise<ChapterInfo | undefined> {
      try {
            /*Get pages URL*/
            const res = await axios.get<Puzzle>(`${this.baseUrl}/at-home/server/${chapterSrc}`)
            const { baseUrl, chapter } = res.data
            const pages = chapter.data.map((e, i): ChapterPage => {
              return {
                page_index: i.toString(),
                src: `${baseUrl}/data/${chapter.hash}/${e}`
              }
            })

            return  {
                main_src: '',
                mangaTitle: '',
                nextChapter: '', 
                prevChapter: '',
                src: '',
                title: '',
                pages
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
