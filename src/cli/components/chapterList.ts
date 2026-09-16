
import type { MangaProvider, MangaInfo, Chapter, ChapterLanguage, Translations} from "../../types/types.js";
import type { LocalTrackerProps } from "../../trackers/local.ts";
import type { Choice, PromptObject } from "@alex_521/prompts";
import { LocalTracker } from "../../trackers/local.ts";
import { getIi8n, type LangIso } from "../../functions/lang.ts";
import { Configuration } from "../../functions/configuration.ts";
import ora from "ora";
import prompts from "@alex_521/prompts";
import { basicChapterOptions, chapterListPrompt, askChapterLang } from "../prompts.ts";
import { SignalsCodes } from "../../types/enum.ts";
import { Notify } from "../../functions/notify.ts";
import { extractTitleByLang } from "../../utils.ts";
import chalk from "chalk";
const localTracker = LocalTracker.getInstance()
const CONF = await Configuration.getInstance()
const oraLoader = ora()

export type ChaperSelectOnSelectType = (
  data: {
  chapterActions: number,
  chaptersList: Chapter[],
  chapterIndex: number,
  chapterLanguage: LangIso, 
  targetChapter: ChapterLanguage
},
breakLoop: ()=>void
) => Promise<void>


export async function ChapterSelect( 
  provider: MangaProvider, 
  mangaInfo: MangaInfo, 
  memoizeChapters: Chapter[] | undefined = undefined, 
  onSelect: ChaperSelectOnSelectType,
  options: PromptObject | undefined = undefined
)
{
  const languageInterface = await CONF.getLanguageInterface()
  const {i18nErrors, i18nGenerics, i18nLanguage, i18nLoadings} = getIi8n(languageInterface)

  oraLoader.start(`${i18nLoadings.loading_chapters}...`);
  try {
    const chapterList = memoizeChapters || await provider.getChapterList(mangaInfo.src)

    if( !chapterList || chapterList.length < 0) {
      oraLoader.fail(i18nErrors.chapter_loading.msg);
      return;
    }
    if (oraLoader.isSpinning) 
        oraLoader.stop();

    const chaptersCount = Math.max(
      chapterList.length,
      chapterList[0].number,
      chapterList[chapterList.length -1].number,
    )

    const localTrackerProps: LocalTrackerProps = {
      chapterCount: chaptersCount,
      chapterIndex: 0,
      mangaId: mangaInfo.src
    }

    if(await localTracker.exists(localTrackerProps) === false ){
      await localTracker.regist(localTrackerProps)
    }

    let trackerData = await localTracker.getStats(localTrackerProps)
    const chaptersCountDiff = trackerData.chapterCount - chaptersCount
    if (chaptersCountDiff <= 0) {
      await localTracker.update(localTrackerProps)
    }

    let memoizedLastChoice = 0;
    let mainLoop  = true
    const breakLoop = ()=> mainLoop = false
    while (mainLoop) {
      trackerData = await localTracker.getStats(localTrackerProps)

      const choices: Choice[] = chapterList.map((e, i) => {
        let title = extractTitleByLang(e, i18nLanguage.meta.lang as Translations)
        if(trackerData.readingMap.has(e.number)){
          title += ' ⏺ ' + chalk.dim(chalk.green(i18nGenerics.read))
        }
        return {
          title,
          value: String(i),
        };
      });

      const readProgress = (  (trackerData.reading*100 ) / trackerData.chapterCount).toFixed(1)
      const chapterSelect = await prompts( chapterListPrompt(
        mangaInfo.title, 
        memoizedLastChoice, 
        choices, 
        `⏺ ${i18nGenerics.progress}: ${readProgress}%`
        )
      );

      if (!chapterSelect.target) break;
      const chapterIndex = parseInt(chapterSelect.target)
      const targetChapter = chapterList[chapterIndex];
      let chapterLanguage: LangIso;
      memoizedLastChoice = chapterIndex

      if ((chapterLanguage = await askChapterLang(targetChapter)) === null) {
        continue;
      }
      const chapterActions = await prompts(options || basicChapterOptions());

      if (!chapterActions.target || chapterActions.target === SignalsCodes.exit) {
        continue;
      }
      await onSelect({
        chapterActions: chapterActions.target as number,
        chapterIndex: chapterIndex,
        chapterLanguage: chapterLanguage,
        chaptersList: chapterList,
        targetChapter: targetChapter.translations[chapterLanguage]!
      }, breakLoop)
    }
  } catch (e) {
    if(oraLoader.isSpinning) oraLoader.stop()
    if(e instanceof Error)
      Notify.pushError(e)
  }
}
