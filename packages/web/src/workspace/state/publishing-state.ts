import { useEffect, useState } from "react";
import { useIntl } from "react-intl";
import { defaultPublishingSettings, getPublishLimitProfile, getPublishingLength, isPublishLimitProfileId, preparePlainTextForPublishing, type Article, type PublishingSettings } from "@skladno/shared";
import type { EditorialWorkspaceClient } from "../../application-client.js";
import { useNotifications } from "../../notifications/NotificationProvider.js";


export function usePublishing(client: EditorialWorkspaceClient, article: Article | undefined, content: string, updateArticle: (articleId: string, input: import("@skladno/shared").UpdateArticleInput) => Promise<void>) {
    const intl = useIntl();
    const { notify } = useNotifications();
    const [settings, setSettings] = useState<PublishingSettings>(defaultPublishingSettings);

    useEffect(() => {
        client.getPublishingSettings()
            .then(setSettings)
            .catch(() => notify({ tone: "info", title: intl.formatMessage({ id: "publishing.defaultProfile" }) }));
    }, [client, intl, notify]);

    const text = preparePlainTextForPublishing(content);
    const profileId = isPublishLimitProfileId(article?.publishingProfileId) ? article.publishingProfileId : settings.defaultProfileId;
    const profile = getPublishLimitProfile(profileId, settings);

    return {
        text,
        profileId,
        profile,
        settings,
        length: getPublishingLength(text, profile),
        setProfile: async (id: typeof profileId) => {
            if (!article)
                return;

            try {
                await updateArticle(article.id, { publishingProfileId: id });
            } catch (error) {
                notify({ tone: "error", title: intl.formatMessage({ id: "publishing.profileSaveFailed" }) });
                throw error;
            }
        },
        copy: async () => {
            try {
                await navigator.clipboard.writeText(text);
                notify({ tone: "success", title: intl.formatMessage({ id: "publishing.copied" }) });
            } catch {
                notify({ tone: "error", title: intl.formatMessage({ id: "publishing.copyFailed" }) });
            }
        }
    };
}


export type PublishingState = ReturnType<typeof usePublishing>;
