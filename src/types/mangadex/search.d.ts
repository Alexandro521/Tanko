
export interface SearchResultMangadex {
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
  related?: string | null;
}

export interface Attributes {
  title: Title;
  altTitles: AltTitles[] | unknown[];
  description: Description;
  isLocked: boolean;
  links: Links;
  officialLinks: null;
  originalLanguage: string;
  lastVolume: string | null;
  lastChapter: string | null;
  publicationDemographic: string | null;
  status: string;
  year: number | null;
  contentRating: string;
  tags: Tags[];
  state: string;
  chapterNumbersResetOnNewVolume: boolean;
  createdAt: string;
  updatedAt: string;
  version: number;
  availableTranslatedLanguages: string[];
  latestUploadedChapter: string;
}

export interface Tags {
  id: string;
  type: string;
  attributes: Attributes2;
  relationships: unknown[];
}

export interface Attributes2 {
  name: Name;
  description: Description2;
  group: string;
  version: number;
}

export interface Name {
  en: string;
}

export interface Links {
  al?: string | null;
  mu?: string | null;
  mal?: string | null;
  engtl?: string | null;
  raw?: string | null;
  ap?: string | null;
  bw?: string | null;
  kt?: string | null;
  amz?: string | null;
  ebj?: string | null;
}

export interface Description {
  en: string;
  kk?: string | null;
  pt?: string | null;
  ru?: string | null;
  "pt-br"?: string | null;
  fa?: string | null;
}

export interface AltTitles {
  ro?: string | null;
  es?: string | null;
  hu?: string | null;
  vi?: string | null;
  ru?: string | null;
  he?: string | null;
  th?: string | null;
  zh?: string | null;
  ko?: string | null;
  kk?: string | null;
  pt?: string | null;
  "pt-br"?: string | null;
  tr?: string | null;
  ja?: string | null;
  "ja-ro"?: string | null;
  en?: string | null;
  cv?: string | null;
  bn?: string | null;
}
export interface Title {
  en?: string | null;
  "ja-ro"?: string | null;
}
