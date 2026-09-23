import type { TranslationsData } from "./translations-view-data.js";


type Translation = NonNullable<TranslationsData["translations"]>[number];

export type { Translation };
