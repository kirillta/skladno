import { useEffect, useState } from "react";
import { useIntl } from "react-intl";
import type { StyleCorpus } from "@skladno/shared";
import type { EditorialWorkspaceClient } from "../../application-client.js";
import { useNotifications } from "../../notifications/NotificationProvider.js";


export function useStyleCorpus(client: EditorialWorkspaceClient) {
    const intl = useIntl();
    const { notifyError } = useNotifications();
    const [corpus, setCorpus] = useState<StyleCorpus>();

    useEffect(() => {
        client.getStyleCorpus().then(setCorpus).catch((error) => notifyError(error, { fallbackMessage: intl.formatMessage({ id: "errors.generic" }) }));
    }, [client, intl, notifyError]);

    return {
        corpus,
        add: async (name: string, content: string, origin?: "import") => {
            try {
                setCorpus(await client.addStyleCorpusItem({ name, content, origin }));
            } catch (error) {
                notifyError(error, { fallbackMessage: intl.formatMessage({ id: "errors.generic" }) });
                throw error;
            }
        },
        remove: async (id: string) => {
            try {
                await client.removeStyleCorpusItem(id);
                setCorpus(await client.getStyleCorpus());
            } catch (error) {
                notifyError(error, { fallbackMessage: intl.formatMessage({ id: "errors.generic" }) });
                throw error;
            }
        },
        setIncluded: async (id: string, included: boolean) => setCorpus(await client.setStyleCorpusItemIncluded(id, included)),
        setRules: async (rules: string) => setCorpus(await client.setStyleCorpusRules(rules)),
        rebuild: async () => setCorpus(await client.rebuildStyleCorpus()),
        getArticleRules: (articleId: string) => client.getArticleStyleRules(articleId),
        setArticleRules: (articleId: string, rules: string) => client.setArticleStyleRules(articleId, rules),
    };
}


export type StyleCorpusState = ReturnType<typeof useStyleCorpus>;
