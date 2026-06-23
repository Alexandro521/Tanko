import es from "../lang/es.json" with {type : "json"};
import en from "../lang/en.json" with {type : "json"};
import fr from "../lang/fr.json" with {type : "json"};
import type { LangInterface , AvalibleLangs} from "../types/lang.js";
export const LANGUAGE_REGISTER: {[key in AvalibleLangs]: LangInterface} = {
    es,
    en,
    fr
} as const;
