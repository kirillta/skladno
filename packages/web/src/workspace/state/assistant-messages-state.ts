import { useCallback, useEffect, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { ApplicationClientError, ASSISTANT_EVENT, type AssistantEditorialResult, type AssistantMessage, type BuiltInSkillId, type FactCheckClaimPreview } from "@skladno/shared";
import type { EditorialWorkspaceClient } from "../../application-client.js";
import { errorMessageId } from "../../i18n/errors.js";
import type { ArticleWorkspaceState } from "./article-workspace-state.js";
import { providerLanguageName } from "./editorial-language.js";

type ProposalState = "idle" | "streaming" | "error";


export function useAssistantMessages(client: EditorialWorkspaceClient, workspace: ArticleWorkspaceState, selection: string | undefined, onResult: (articleId: string, baseRevisionId: string, result: AssistantEditorialResult, editorialArtifactId?: string) => void, profileRebuilt?: { articleId: string; count: number; token: number }) {
    const intl = useIntl();
    const [messagesByArticle, setMessagesByArticle] = useState<Record<string, AssistantMessage[]>>({});
    const [stateByArticle, setStateByArticle] = useState<Record<string, ProposalState>>({});
    const [messageByArticle, setMessageByArticle] = useState<Record<string, string>>({});
    const [errorDetailsByArticle, setErrorDetailsByArticle] = useState<Record<string, string>>({});
    const [factCheckClaimsByArticle, setFactCheckClaimsByArticle] = useState<Record<string, FactCheckClaimPreview[]>>({});
    const controller = useRef<AbortController>();
    const article = workspace.selectedArticle;
    const messages = article ? messagesByArticle[article.id] : undefined;
    const state = article ? stateByArticle[article.id] ?? "idle" : "idle";
    const message = article ? messageByArticle[article.id] ?? "" : "";
    const errorDetails = article ? errorDetailsByArticle[article.id] : undefined;

    const reload = useCallback(async (articleId: string | undefined = article?.id) => {
        if (!articleId)
            return;

        const items = await client.listAssistantMessages(articleId);
        setMessagesByArticle((current) => ({
            ...current,
            [articleId]: items,
        }));
    }, [article, client]);

    useEffect(() => {
        let cancelled = false;
        if (!article)
            return () => {
                cancelled = true;
            };

        void client.listAssistantMessages(article.id)
            .then((items) => {
                if (!cancelled)
                    setMessagesByArticle((current) => ({
                        ...current,
                        [article.id]: items,
                    }));
            })
            .catch(() => {
                if (!cancelled)
                    setMessagesByArticle((current) => {
                        const remaining = { ...current };
                        delete remaining[article.id];

                        return remaining;
                    });
            });

        return () => {
            cancelled = true;
        };
    }, [article, client]);

    useEffect(() => {
        if (!article || !profileRebuilt || profileRebuilt.articleId !== article.id)
            return;

        const timestamp = new Date().toISOString();
        setMessagesByArticle((current) => ({
            ...current,
            [article.id]: [...(current[article.id] ?? []), {
                id: `profile-rebuilt-${profileRebuilt.token}`,
                articleId: article.id,
                role: "system",
                kind: "status",
                status: "completed",
                template: "profile_rebuilt",
                content: String(profileRebuilt.count),
                createdAt: timestamp,
                updatedAt: timestamp,
            }],
        }));
    }, [article, profileRebuilt]);

    const request = useCallback(async (authorMessage: string, explicitSkillId?: BuiltInSkillId, targetLanguage?: string | readonly string[], skillOffset?: number) => {
        const current = workspace.selectedArticle;
        if (!current)
            return;

        if (targetLanguage && typeof targetLanguage !== "string") {
            for (const language of targetLanguage)
                await request(authorMessage, explicitSkillId, language, skillOffset);

            return;
        }

        try {
            const saved = await workspace.save(current.id);
            const revision = saved ?? current.currentRevision;
            setMessageByArticle((messages) => {
                const next = { ...messages };
                delete next[current.id];

                return next;
            });
            setErrorDetailsByArticle((details) => {
                const next = { ...details };
                delete next[current.id];

                return next;
            });
            setStateByArticle((states) => ({
                ...states,
                [current.id]: "streaming",
            }));
            setFactCheckClaimsByArticle((claims) => ({ ...claims, [current.id]: [] }));
            controller.current = new AbortController();
            const streamedId = `streaming-${crypto.randomUUID()}`;
            const selectedContent = selection && workspace.content.includes(selection) ? selection : undefined;
            const selectionStart = selectedContent ? workspace.content.indexOf(selectedContent) : -1;
            await client.streamAssistantRequest(current.id, {
                requestId: crypto.randomUUID(),
                authorMessage,
                scope: selectedContent && selectionStart >= 0
                    ? { kind: "selection", baseRevisionId: revision.id, startOffset: selectionStart, endOffset: selectionStart + selectedContent.length }
                    : { kind: "article", baseRevisionId: revision.id },
                ...(explicitSkillId ? { explicitSkillId } : {}),
                ...(skillOffset === undefined ? {} : { skillOffset }),
                ...(targetLanguage ? { targetLanguage: providerLanguageName(targetLanguage) } : {}),
            }, (event) => {
                if (event.type === ASSISTANT_EVENT.TOOL_STATUS && event.claims)
                    setFactCheckClaimsByArticle((claims) => ({ ...claims, [current.id]: event.claims! }));

                if (event.type === ASSISTANT_EVENT.COMPLETED && event.result) {
                    const result = event.result;
                    onResult(current.id, revision.id, result, event.editorialArtifactId);
                    if (result.factCheck)
                        setFactCheckClaimsByArticle((claims) => ({ ...claims, [current.id]: result.factCheck!.findings.map(({ claim }) => ({ claim, checked: true })) }));
                }

                if (event.type !== ASSISTANT_EVENT.TEXT_DELTA)
                    return;

                setMessagesByArticle((itemsByArticle) => {
                    const items = itemsByArticle[current.id];
                    const streamed = items?.find((item) => item.id === streamedId);
                    const next = {
                        id: streamedId,
                        articleId: current.id,
                        role: "assistant" as const,
                        kind: "response" as const,
                        status: "pending" as const,
                        content: `${streamed?.content ?? ""}${event.delta}`,
                        createdAt: streamed?.createdAt ?? new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                    };

                    return {
                        ...itemsByArticle,
                        [current.id]: [...(items ?? []).filter((item) => item.id !== streamedId), next],
                    };
                });
            }, controller.current.signal);
            await reload(current.id);
            setStateByArticle((states) => ({
                ...states,
                [current.id]: "idle",
            }));
        } catch (error) {
            if ((error as DOMException).name === "AbortError") {
                await reload(current.id).catch(() => undefined);
                setStateByArticle((states) => ({
                    ...states,
                    [current.id]: "idle",
                }));

                return;
            }

            setStateByArticle((states) => ({
                ...states,
                [current.id]: "error",
            }));
            setMessageByArticle((messages) => ({
                ...messages,
                [current.id]: intl.formatMessage({ id: "assistant.requestStartFailed" }),
            }));
            setErrorDetailsByArticle((details) => ({
                ...details,
                [current.id]: error instanceof ApplicationClientError
                    ? intl.formatMessage({ id: errorMessageId(error.code) }, error.parameters)
                    : intl.formatMessage({ id: "errors.editorialRequestFailed" }),
            }));

            await reload(current.id).catch(() => undefined);
        }
    }, [client, intl, onResult, reload, selection, workspace]);

    return { messages, state, message, errorDetails, factCheckClaims: article ? factCheckClaimsByArticle[article.id] : undefined, request, cancel: () => controller.current?.abort() };
}


export type AssistantMessagesState = ReturnType<typeof useAssistantMessages>;
