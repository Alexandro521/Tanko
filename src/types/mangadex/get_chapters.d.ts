export interface ChapterListMangadex {
  result: string;
  response: string;
  data: Data[];
  limit: number;
  offset: number;
  total: number;
}

export interface Data {
  id: string;
  type: string;
  attributes: Attributes;
  relationships: Relationships[];
}

export interface Relationships {
  id: string;
  type: string;
}

export interface Attributes {
  volume: string | null;
  chapter: string | null;
  title: null | string;
  translatedLanguage: string;
  externalUrl: null;
  isUnavailable: boolean;
  publishAt: string;
  readableAt: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  pages: number;
}