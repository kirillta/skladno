import { useEffect, useState, type ReactNode } from "react";
import { IntlProvider } from "react-intl";
import { defaultInterfaceLocale, type ApplicationSettingsClient, type InterfaceLocale } from "@skladno/shared";
import { catalogByLocale } from "./catalogs.js";
import { messages } from "./messages.js";

export function I18nProvider({ client, children }: { client: ApplicationSettingsClient; children: ReactNode }) {
    const [locale, setLocale] = useState<InterfaceLocale>(defaultInterfaceLocale);

    useEffect(() => {
        void client.getApplicationSettings().then((settings) => {
            if (catalogByLocale.has(settings.general.interfaceLocale))
                setLocale(settings.general.interfaceLocale);
        }).catch(() => undefined);
    }, [client]);

    const catalog = catalogByLocale.get(locale)?.messages ?? messages;
    return <IntlProvider locale={locale} defaultLocale={defaultInterfaceLocale} messages={catalog} defaultFormats={{}}>{children}</IntlProvider>;
}
