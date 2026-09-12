import { APPLICATION_ERROR, ASSISTANT_EVENT, HTTP_STATUS, type AssistantEditorialResult, type AssistantEvent, type AssistantResponseKind, type FactCheck } from "@skladno/shared";

import { ApplicationServiceError } from "../../errors/application-service-error.js";
import { persistFactCheckArtifact } from "../../helpers/editorial/persist-fact-check-artifact.js";
import { EDITORIAL_CAPABILITY } from "./editorial-capability-catalog.js";
import type { CompletionEvent } from "../../models/assistant/completion-event.js";
import type { PreparedAssistantRequest } from "../../models/assistant/prepared-assistant-request.js";
import type { FactChecksStore } from "../../models/assistant/fact-checks-store.js";
import type { ArticleStore } from "../articles/article-store.js";
import type { StyleCorpusStore } from "../editorial/style-corpus-store.js";
import type { AssistantArtifactStore } from "./assistant-artifact-store.js";
import type { AssistantStore } from "./assistant-store.js";
import type { EditorialCapabilityCatalog } from "./editorial-capability-catalog.js";


function completedContent(request: PreparedAssistantRequest, text: string): string {
    if (request.scope.kind !== "selection" || !request.completedCapability || request.completedCapability === EDITORIAL_CAPABILITY.FACT_CHECK)
        return text;

    return `${request.articleContent.slice(0, request.scope.startOffset)}${text}${request.articleContent.slice(request.scope.endOffset)}`;
}


export function responseKind(capability?: string): AssistantResponseKind {
    switch (capability) {
        case EDITORIAL_CAPABILITY.FACT_CHECK:
            return "findings_prepared";
        case EDITORIAL_CAPABILITY.STYLE_REVIEW:
            return "proposal_and_findings_prepared";
        case EDITORIAL_CAPABILITY.TRANSLATE:
            return "translation_proposal_prepared";
        case EDITORIAL_CAPABILITY.GENERATE_PROPOSAL:
            return "proposal_prepared";
        default:
            return "editorial_conversation";
    }
}


export class AssistantCompletion {
    constructor(private readonly dependencies: {
        articles: ArticleStore;
        assistant: AssistantStore;
        styleCorpus: StyleCorpusStore;
        artifacts: AssistantArtifactStore;
        factChecks: FactChecksStore;
        capabilities?: EditorialCapabilityCatalog;
    }) { }


    persist(request: PreparedAssistantRequest, event: CompletionEvent): Omit<Extract<AssistantEvent, { type: typeof ASSISTANT_EVENT.COMPLETED }>, "type" | "requestId"> {
        return this.dependencies.assistant.completeRun(() => this.persistInTransaction(request, event));
    }


    private persistInTransaction(request: PreparedAssistantRequest, event: CompletionEvent): Omit<Extract<AssistantEvent, { type: typeof ASSISTANT_EVENT.COMPLETED }>, "type" | "requestId"> {
        const article = this.dependencies.articles.get(request.articleId);
        if (!article || article.currentRevisionId !== request.scope.baseRevisionId)
            throw new ApplicationServiceError(APPLICATION_ERROR.REVISION_CONFLICT, HTTP_STATUS.CONFLICT);

        const metadataChanged = this.applyPendingActions(request);
        const content = completedContent(request, event.text);
        const kind = responseKind(request.completedCapability);
        const artifact = this.createCompletionArtifact(request, event, content);

        const result = this.completionResult(request, event, content, artifact.factCheck, metadataChanged);
        const input = {
            requestId: request.requestId,
            articleId: request.articleId,
            ...(request.resolvedSkillId ? { skillId: request.resolvedSkillId } : {}),
            responseKind: kind,
            content: request.completedCapability ? "" : content,
            proposalContent: result?.proposal,
            editorialArtifactId: artifact.id
        };
        const message = this.dependencies.assistant.completeRequest(input);

        return { responseKind: kind, messageId: message.id, ...(artifact.id ? { editorialArtifactId: artifact.id } : {}), ...(result ? { result } : {}) };
    }


    private applyPendingActions(request: PreparedAssistantRequest): boolean {
        let metadataChanged = false;
        for (const action of request.pendingActions) {
            this.dependencies.capabilities!
                .action(action.capability, {
                    articleId: request.articleId,
                    baseRevisionId: request.scope.baseRevisionId,
                    authorizedActions: request.authorizedActions
                }, action.input);

            metadataChanged
                ||= action.capability === EDITORIAL_CAPABILITY.RENAME_ARTICLE
                || action.capability === EDITORIAL_CAPABILITY.CHANGE_ARTICLE_LANGUAGE
                || action.capability === EDITORIAL_CAPABILITY.ASSIGN_PUBLISHING_PROFILE
                || action.capability === EDITORIAL_CAPABILITY.SET_ARTICLE_STYLE_RULES;
        }

        return metadataChanged;
    }


    private createCompletionArtifact(request: PreparedAssistantRequest, event: CompletionEvent, content: string): { id?: string; factCheck?: FactCheck } {
        if (!request.completedCapability)
            return {};

        const metadata = {
            requestId: request.requestId,
            ...(request.resolvedSkillId ? { resolvedSkillId: request.resolvedSkillId } : {}),
            capability: request.completedCapability,
            ...(request.explicitSkillId ? { skillSource: "explicit" } : {}),
            authorGuidance: request.authorMessage,
            scope: request.scope,
            responseId: event.responseId,
            proposal: content,
            ...(request.completedCapability === EDITORIAL_CAPABILITY.STYLE_REVIEW
                ? { styleProfile: this.dependencies.styleCorpus.get().profile, articleStyleRules: this.dependencies.styleCorpus.getArticleRules(request.articleId) }
                : {}
            ),
            translation: event.translation
        };
        if (request.completedCapability === EDITORIAL_CAPABILITY.FACT_CHECK && event.factCheck) {
            const input = {
                artifacts: this.dependencies.artifacts,
                factChecks: this.dependencies.factChecks,
                articleId: request.articleId,
                revisionId: request.scope.baseRevisionId,
                metadata,
                factCheck: event.factCheck,
            };
            const persisted = persistFactCheckArtifact(input);
            return { id: persisted.artifactId, factCheck: persisted.factCheck };
        }

        return {
            id: this.dependencies.artifacts.create({
                articleId: request.articleId,
                revisionId: request.scope.baseRevisionId,
                kind: "assistant-proposal",
                content: JSON.stringify({ ...metadata, findings: event.styleReview }),
            }).id,
        };
    }


    private completionResult(request: PreparedAssistantRequest, event: CompletionEvent, content: string, factCheck: FactCheck | undefined, metadataChanged: boolean): AssistantEditorialResult | undefined {
        if (!request.completedCapability && !metadataChanged)
            return undefined;

        return {
            ...(metadataChanged ? { metadataChanged: true } : {}),
            ...(request.completedCapability === EDITORIAL_CAPABILITY.FACT_CHECK && factCheck ? { factCheck } : {}),
            ...(request.completedCapability === EDITORIAL_CAPABILITY.STYLE_REVIEW ? { proposal: content, ...(event.styleReview ? { styleReview: event.styleReview } : {}) } : {}),
            ...(request.completedCapability === EDITORIAL_CAPABILITY.TRANSLATE && event.translation ? { translation: { metadata: event.translation, content } } : {}),
            ...(request.completedCapability === EDITORIAL_CAPABILITY.GENERATE_PROPOSAL ? { proposal: content } : {}),
        };
    }
}
