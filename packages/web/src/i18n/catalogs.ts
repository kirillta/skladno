import { INTERFACE_LOCALE, type InterfaceLocale } from "@skladno/shared";
import type { MessageId } from "./messages.js";
import { en } from "./locales/en.js";

export interface InstalledLocaleCatalog {
    code: InterfaceLocale;
    nameMessageId: MessageId;
    messages: typeof en;
}

export const installedLocaleCatalogs: readonly InstalledLocaleCatalog[] = [{
    code: INTERFACE_LOCALE.EN,
    nameMessageId: "settings.general.interfaceLocale.english",
    messages: en,
}];

export const catalogByLocale: ReadonlyMap<InterfaceLocale, InstalledLocaleCatalog> = new Map(installedLocaleCatalogs.map((catalog) => [catalog.code, catalog]));
