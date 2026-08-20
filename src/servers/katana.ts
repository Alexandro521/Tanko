import axios, { AxiosHeaders } from "axios";
import * as cheerio from "cheerio";
import type { Chapter, ChapterLanguage, ChapterPage, MangaInfo, MangaProvider, ServerName } from "../types/types.ts";
import { GET_USER_AGENT } from "../const.ts";
import { extractChapterNumber, sortChapterList } from "../utils.ts";

export class MangaKatana implements MangaProvider {
  public name: ServerName = 'katana';
  private axioHeaders!:AxiosHeaders
  private baseUrl = 'https://mangakatana.com/'
  constructor() {
    const headers = new AxiosHeaders()
    const agent = GET_USER_AGENT()
    headers.set('User-Agent', agent)
    headers.set('Origin', 'https://mangakatana.com')
    headers.set('Host', 'mangakatana.com')
    this.axioHeaders = headers
  }
  async search(query: string): Promise<MangaInfo[]> {
    const headers = new Headers()
    const agent = GET_USER_AGENT()
    headers.set('Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8')
    headers.set('User-Agent', agent)
    headers.set('Origin', 'https://mangakatana.com')
    headers.set('Host', 'mangakatana.com')
    const res = await fetch(this.baseUrl, {
      method: 'POST',
      headers: headers,
      keepalive: true,
      body: `s=${query}&search_by=m_name`,
    })
    if (!res.ok) throw new Error('Request failed')
    const $ = cheerio.load(await res.text())
    const searchResults: MangaInfo[] = new Array()
    $('div.item').each((_, element) => {
      const anchor = $(element).find('a.title')
      const attributes = anchor.attr()
      let src = attributes?.['href']
      if (src) {
        const id = src.slice(this.baseUrl.length + 6)
        src = id ?? undefined
      }
      searchResults.push(
        {
          title: anchor.text() ?? 'untitled',
          src: src ?? '', 
        }
      )
    })
    return searchResults
  }
  async getLastMangas(): Promise<MangaInfo[]> {
    const res = await axios.get(`${this.baseUrl}/latest`, {
      headers: this.axioHeaders,
    })
    const results: MangaInfo[] = new Array()
    const $ = cheerio.load(res.data)
    const resultsContainer = 'div#wrap_content div#book_list'
    $(resultsContainer).find('div.item').each((_, item) => {
      const anchor = $(item).find('div.text h3.title a')
      const lastChapterAnchor = $(item).find('div.text div.last_chap a')
      const description = $(item).find('div.text h3.title span').text()
      const title = anchor.text()
      const anchorAttr = anchor.attr()
      const lastAnchorAttr = lastChapterAnchor.attr()
      let lastedSrc = lastAnchorAttr?.['href']
      let src = anchorAttr?.['href']
      if (src) {
        const id = src.slice(this.baseUrl.length + 6)
        src = id ?? undefined
      }
      if (lastedSrc) {
        const id = lastedSrc.slice(this.baseUrl.length + 6)
        lastedSrc = id 
      }
      results.push({
        title,
        src: src ?? '',
        description: description,
        lastUploadChapterSrc: lastedSrc
      })
    })
    return results
  }
  async getChapterList(mangaSrc: string): Promise<Chapter[]> {
    const res = await axios.get(`${this.baseUrl}/manga/${mangaSrc}`, {
      headers: this.axioHeaders
    })
    const $ = cheerio.load(res.data)
    const container = 'div#wrap_content div#single_book div.chapters table.uk-table.uk-table-striped tbody tr'
    const chapters: Chapter[] = new Array()
    $(container).each((index, tr) => {
      const anchor = $(tr).find('td:nth-child(1) a')
      const attributes = anchor.attr()
      const title = anchor.text()
      let src = attributes?.['href']
      if (src) {
        const id = src.slice(this.baseUrl.length + 6)
        src = id ?? undefined
      }
      const translation: ChapterLanguage = {
        id: src ?? '',
        lang: 'en',
        title: title,
      }
      chapters.push({
        number: extractChapterNumber(title) || index + 1,
        translation_count: 1,
        translations: {en:  translation },
      })
    })
    return sortChapterList(chapters, 'desc')
  } 
  async getChapterPages(mangaSrc: string): Promise<ChapterPage[]> {
    const res = await axios.get(`${this.baseUrl}/manga/${mangaSrc}`, {
      headers: this.axioHeaders
    })
    const $ = cheerio.load(res.data)
    const script = $('script').toString()
    const findVariable = 'var thzq='
    const indexOf = script.indexOf(findVariable, 3000)
    if (indexOf < 0) {
      throw new Error()
    }
    const pages: ChapterPage[] = new Array()
    let imgUrl = ''
    let pageIndex = 0
    let stop = false
    for (let i = (indexOf + findVariable.length + 1); i < script.length && !stop; i++){
      const char = script[i]
      switch (char) {
        case ']':
          stop = true
          break
        case '\"':
          continue
        case '\'':
          continue
        case '\t':
          continue
        case ',': {
          pages.push({
            src: imgUrl,
            page_index: pageIndex.toString()
          })
          pageIndex++
          imgUrl = ''
          continue
        }
      }
      imgUrl+=char
    }
    return pages
  }
  async getMangaInfo(mangaSrc: string): Promise<MangaInfo> {
    const res = await axios.get(`${this.baseUrl}/manga/${mangaSrc}`, {
      headers: this.axioHeaders
    })
    const $ = cheerio.load(res.data)
    const title = $('h1.heading').text()
    const description = $('div#wrap_content div#single_book div.summary p').text()
    return {
      src: mangaSrc,
      title: title,
      description
    }
  }
  async getPopulars():Promise<MangaInfo[]> {
    const res = await axios.get(`${this.baseUrl}`, {
      headers: this.axioHeaders,
    })
    const results: MangaInfo[] = new Array()
    const $ = cheerio.load(res.data)
    const resultsContainer = 'div#wrap_content div#hot_book div.widget-body'
    $(resultsContainer).find('div.item').each((_, item) => {
      const anchor = $(item).find('div.text h3.title a')
      const lastChapterAnchor = $(item).find('div.chapter a')
      const description = $(item).find('div.chapter a').text()
      const anchorAttr = anchor.attr()
      const lastAnchorAttr = lastChapterAnchor.attr()
      const title = anchor.text()
      let lastedSrc = lastAnchorAttr?.['href']
      let src = anchorAttr?.['href']
      if (src) {
        const id = src.slice(this.baseUrl.length + 6)
        src = id ?? undefined
      }
      if (lastedSrc) {
        const id = lastedSrc.slice(this.baseUrl.length + 6)
        lastedSrc = id 
      }
      results.push({
        title,
        src: src ?? '',
        description: description,
        lastUploadChapterSrc: lastedSrc
      })
    })
    return results
  }
}