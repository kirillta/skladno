import type { AssistantEvent, StartAssistantRequest } from "../assistant/assistant.js";
import type { Article, CreateArticleInput, UpdateArticleInput } from "../articles/article/article.js";
import type { ArticleDraft, SaveArticleDraftInput } from "../articles/draft/draft.js";
import type { AcceptProposalInput, ProposalChangeSummary, SummarizeProposalInput } from "../articles/revision/revisions.js";
import type { ArticleRevision, SaveArticleRevisionInput } from "../articles/revision/revision.js";
import type { HealthResponse } from "./health.js";
import type { ApplicationErrorPayload } from "../cross-cutting/errors.js";
import type { EditorialEvent, FactCheck, FactCheckFinding, StartEditorialRequest } from "../editorial/editorial.js";
import type { ApplicationSettingsSnapshot, BackupPolicy, GeneralSettings, ModelPreferences, OpenAiConnection } from "../settings/settings.js";
import type { KeyBindingOverrides } from "../cross-cutting/key-bindings.js";
import type { CreateStyleCorpusItemInput, StyleCorpus } from "../style/style.js";
import type { PublishingSettings } from "../publishing/publishing.js";


export const ELECTRON_IPC_CHANNEL = {
    invoke: "skladno:application:invoke",
    stream: "skladno:application:stream",
    streamEvent: "skladno:application:stream-event",
    cancel: "skladno:application:cancel",
} as const;


export interface ElectronApplicationOperationMap {
    getHealth: { args: []; result: HealthResponse };
    getApplicationSettings: { args: []; result: ApplicationSettingsSnapshot };
    updateGeneralSettings: { args: [GeneralSettings]; result: GeneralSettings };
    updateBackupPolicy: { args: [BackupPolicy]; result: BackupPolicy };
    updateKeyBindingOverrides: { args: [KeyBindingOverrides]; result: KeyBindingOverrides };
    addOpenAiConnection: { args: [Pick<OpenAiConnection, "label" | "environmentVariableName">]; result: OpenAiConnection };
    updateOpenAiConnection: { args: [string, Pick<OpenAiConnection, "label" | "environmentVariableName">]; result: OpenAiConnection };
    removeOpenAiConnection: { args: [string]; result: void };
    setActiveOpenAiConnection: { args: [string]; result: void };
    testOpenAiConnection: { args: [string]; result: OpenAiConnection };
    refreshOpenAiModels: { args: []; result: string[] };
    updateModelPreferences: { args: [ModelPreferences]; result: ModelPreferences };
    listArticles: { args: []; result: Article[] };
    createArticle: { args: [CreateArticleInput]; result: Article };
    updateArticle: { args: [string, UpdateArticleInput]; result: Article };
    deleteArticle: { args: [string]; result: void };
    saveArticleDraft: { args: [string, SaveArticleDraftInput]; result: ArticleDraft };
    discardArticleDraft: { args: [string, number]; result: void };
    saveArticleRevision: { args: [string, SaveArticleRevisionInput]; result: ArticleRevision };
    listArticleRevisions: { args: [string]; result: ArticleRevision[] };
    acceptProposal: { args: [string, AcceptProposalInput]; result: ArticleRevision };
    summarizeProposal: { args: [string, SummarizeProposalInput]; result: ProposalChangeSummary[] };
    restoreRevision: { args: [string, string]; result: ArticleRevision };
    listAssistantMessages: { args: [string]; result: import("../assistant/assistant.js").AssistantMessage[] };
    listFactChecks: { args: [string]; result: FactCheck[] };
    resolveFactCheckFinding: { args: [string, string, NonNullable<FactCheckFinding["resolution"]>]; result: void };
    getStyleCorpus: { args: []; result: StyleCorpus };
    addStyleCorpusItem: { args: [CreateStyleCorpusItemInput]; result: StyleCorpus };
    setStyleCorpusItemIncluded: { args: [string, boolean]; result: StyleCorpus };
    setStyleCorpusRules: { args: [string]; result: StyleCorpus };
    rebuildStyleCorpus: { args: []; result: StyleCorpus };
    getArticleStyleRules: { args: [string]; result: string };
    setArticleStyleRules: { args: [string, string]; result: string };
    addArticleRevisionStyleCorpusItem: { args: [string, string]; result: StyleCorpus };
    removeStyleCorpusItem: { args: [string]; result: void };
    getPublishingSettings: { args: []; result: PublishingSettings };
    setPublishingSettings: { args: [PublishingSettings]; result: PublishingSettings };
}


export type ElectronApplicationMethod = keyof ElectronApplicationOperationMap;

export const ELECTRON_APPLICATION_METHOD = {
    getHealth: "getHealth",
    getApplicationSettings: "getApplicationSettings",
    updateGeneralSettings: "updateGeneralSettings",
    updateBackupPolicy: "updateBackupPolicy",
    updateKeyBindingOverrides: "updateKeyBindingOverrides",
    addOpenAiConnection: "addOpenAiConnection",
    updateOpenAiConnection: "updateOpenAiConnection",
    removeOpenAiConnection: "removeOpenAiConnection",
    setActiveOpenAiConnection: "setActiveOpenAiConnection",
    testOpenAiConnection: "testOpenAiConnection",
    refreshOpenAiModels: "refreshOpenAiModels",
    updateModelPreferences: "updateModelPreferences",
    listArticles: "listArticles",
    createArticle: "createArticle",
    updateArticle: "updateArticle",
    deleteArticle: "deleteArticle",
    saveArticleDraft: "saveArticleDraft",
    discardArticleDraft: "discardArticleDraft",
    saveArticleRevision: "saveArticleRevision",
    listArticleRevisions: "listArticleRevisions",
    acceptProposal: "acceptProposal",
    summarizeProposal: "summarizeProposal",
    restoreRevision: "restoreRevision",
    listAssistantMessages: "listAssistantMessages",
    listFactChecks: "listFactChecks",
    resolveFactCheckFinding: "resolveFactCheckFinding",
    getStyleCorpus: "getStyleCorpus",
    addStyleCorpusItem: "addStyleCorpusItem",
    setStyleCorpusItemIncluded: "setStyleCorpusItemIncluded",
    setStyleCorpusRules: "setStyleCorpusRules",
    rebuildStyleCorpus: "rebuildStyleCorpus",
    getArticleStyleRules: "getArticleStyleRules",
    setArticleStyleRules: "setArticleStyleRules",
    addArticleRevisionStyleCorpusItem: "addArticleRevisionStyleCorpusItem",
    removeStyleCorpusItem: "removeStyleCorpusItem",
    getPublishingSettings: "getPublishingSettings",
    setPublishingSettings: "setPublishingSettings",
} as const satisfies { [Method in ElectronApplicationMethod]: Method };

export type ElectronInvokeRequest = {
    [Method in ElectronApplicationMethod]: {
        method: Method;
        args: ElectronApplicationOperationMap[Method]["args"];
    };
}[ElectronApplicationMethod];

export type ElectronInvokeResult<Method extends ElectronApplicationMethod = ElectronApplicationMethod> = {
    [Key in Method]:
        | { ok: true; value: ElectronApplicationOperationMap[Key]["result"] }
        | { ok: false; error: ElectronIpcError };
}[Method];


export interface ElectronIpcError extends ApplicationErrorPayload {
    status: number;
    article?: Article;
    draft?: ArticleDraft;
}


export type ElectronStreamRequest =
    | {
        streamId: string;
        kind: "assistant";
        articleId: string;
        input: StartAssistantRequest;
    }
    | {
        streamId: string;
        kind: "editorial";
        articleId: string;
        input: StartEditorialRequest;
    };


export type ElectronStreamEvent =
    | {
        streamId: string;
        kind: "assistant";
        event: AssistantEvent;
    }
    | {
        streamId: string;
        kind: "editorial";
        event: EditorialEvent;
    };


export interface ElectronCancelRequest {
    streamId: string;
}


export function isElectronApplicationMethod(value: unknown): value is ElectronApplicationMethod {
    return typeof value === "string" && Object.values(ELECTRON_APPLICATION_METHOD).includes(value as ElectronApplicationMethod);
}
