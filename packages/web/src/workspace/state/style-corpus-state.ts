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
        add: async (name: string | undefined, content: string, origin?: "import") => {
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
        setIncluded: async (id: string, included: boolean) => {
            try {
                setCorpus(await client.setStyleCorpusItemIncluded(id, included));
            } catch (error) {
                notifyError(error, { fallbackMessage: intl.formatMessage({ id: "errors.generic" }) });
                throw error;
            }
        },
        setRules: async (rules: string) => {
            try {
                setCorpus(await client.setStyleCorpusRules(rules));
            } catch (error) {
                notifyError(error, { fallbackMessage: intl.formatMessage({ id: "errors.generic" }) });
                throw error;
            }
        },
        rebuild: async () => {
            try {
                setCorpus(await client.rebuildStyleCorpus());
            } catch (error) {
                notifyError(error, { fallbackMessage: intl.formatMessage({ id: "errors.generic" }) });
                throw error;
            }
        },
        getArticleRules: async (articleId: string) => {
            try {
                return await client.getArticleStyleRules(articleId);
            } catch (error) {
                notifyError(error, { fallbackMessage: intl.formatMessage({ id: "errors.generic" }) });
                throw error;
            }
        },
        setArticleRules: async (articleId: string, rules: string) => {
            try {
                return await client.setArticleStyleRules(articleId, rules);
            } catch (error) {
                notifyError(error, { fallbackMessage: intl.formatMessage({ id: "errors.generic" }) });
                throw error;
            }
        },
    };
}


export type StyleCorpusState = ReturnType<typeof useStyleCorpus>;
