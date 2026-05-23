import es from "../lang/es.json" with {type : "json"};
import en from "../lang/en.json" with {type : "json"};
import type { LangInterface , AvalibleLangs} from "../types/lang.js";
export const lang: {[key in AvalibleLangs]: LangInterface} = {
    es,
    en
} as const;
