import { APPLICATION_ERROR, ASSISTANT_EVENT, HTTP_STATUS, type AssistantEditCandidate, type AssistantEditorialResult, type AssistantEvent, type AssistantResponseKind, type FactCheck } from "@skladno/shared";

import { ApplicationServiceError } from "../../errors/application-service-error.js";
import { persistFactCheckArtifact } from "../../editorial/fact-checking/persist-fact-check-artifact.js";
import { protectArticleSpans } from "../../editorial/translation/translation.js";
import { EDITORIAL_CAPABILITY } from "../capabilities/editorial-capability-catalog.js";
import type { CompletionEvent } from "./completion-event.js";
import type { PreparedAssistantRequest } from "../requests/prepared-assistant-request.js";
import type { FactChecksStore } from "../fact-checks-store.js";
import type { ArticleStore } from "../../articles/article-store.js";
import type { StyleCorpusStore } from "../../editorial/style/style-corpus-store.js";
import type { AssistantArtifactStore } from "../assistant-artifact-store.js";
import type { AssistantStore } from "../assistant-store.js";
import type { EditorialCapabilityCatalog } from "../capabilities/editorial-capability-catalog.js";


export function getCompletedContent(request: PreparedAssistantRequest, text: string): string {
    if (request.scope.kind !== "selection" || !request.completedCapability || request.completedCapability === EDITORIAL_CAPABILITY.FACT_CHECK)
        return text;

    return `${request.articleContent.slice(0, request.scope.startOffset)}${text}${request.articleContent.slice(request.scope.endOffset)}`;
}


function preservesProtectedContent(source: string, replacement: string): boolean {
    const protectedSpans = protectArticleSpans(source).protectedSpans;
    const sourceNumbers = source.match(/\b\d+(?:[.,]\d+)*\b/g) ?? [];
    const replacementNumbers = replacement.match(/\b\d+(?:[.,]\d+)*\b/g) ?? [];
    if (sourceNumbers.sort().join("\u0000") !== replacementNumbers.sort().join("\u0000"))
        return false;

    return ![...new Set(protectedSpans)].some((span) => source.split(span).length !== replacement.split(span).length);
}


export function getEditCandidate(request: PreparedAssistantRequest, event: CompletionEvent): AssistantEditCandidate | undefined {
    if (!request.editCandidateAuthorized || request.completedCapability !== EDITORIAL_CAPABILITY.GENERATE_PROPOSAL || !event.text.trim())
        return undefined;

    const source = request.scope.kind === "selection"
        ? request.articleContent.slice(request.scope.startOffset, request.scope.endOffset)
        : request.articleContent;
    const replacement = event.text;
    if (replacement === source || /(?:^|\n)\s*(?:option|version|alternative)\s*[12]\s*[:.)]/i.test(replacement) || !preservesProtectedContent(source, replacement))
        return undefined;

    return request.scope.kind === "selection"
        ? { target: "selection", original: source, replacement }
        : { target: "article", replacement };
}


export function getResponseKind(capability?: string): AssistantResponseKind {
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
        const article = this.dependencies.articles.getArticle(request.articleId);
        if (!article || article.currentRevisionId !== request.scope.baseRevisionId)
            throw new ApplicationServiceError(APPLICATION_ERROR.REVISION_CONFLICT, HTTP_STATUS.CONFLICT);

        const metadataChanged = this.applyPendingActions(request);
        const editCandidate = getEditCandidate(request, event);
        const directEdit = Boolean(editCandidate && request.editMode === "direct" && request.directEditAuthorized);
        const content = getCompletedContent(request, event.text);
        const kind = directEdit ? "edit_applied" : getResponseKind(request.completedCapability);
        const artifact = directEdit ? {} : this.createCompletionArtifact(request, event, content);

        return this.persistResponse({ request, event, content, editCandidate, directEdit, kind, artifact, metadataChanged });
    }


    private persistResponse(input: { request: PreparedAssistantRequest; event: CompletionEvent; content: string; editCandidate?: AssistantEditCandidate; directEdit: boolean; kind: AssistantResponseKind; artifact: { id?: string; factCheck?: FactCheck }; metadataChanged: boolean }): Omit<Extract<AssistantEvent, { type: typeof ASSISTANT_EVENT.COMPLETED }>, "type" | "requestId"> {
        const { request, event, content, editCandidate, directEdit, kind, artifact, metadataChanged } = input;
        const result = this.getCompletionResult(request, event, content, artifact.factCheck, metadataChanged);
        const reply = {
            requestId: request.requestId,
            articleId: request.articleId,
            ...(request.resolvedSkillId ? { skillId: request.resolvedSkillId } : {}),
            responseKind: kind,
            content: request.completedCapability ? "" : content,
            proposalContent: directEdit ? undefined : result?.proposal,
            editorialArtifactId: artifact.id,
            ...(editCandidate ? { editCandidate, directEdit } : {}),
            ...(directEdit && request.editDescription ? { editDescription: request.editDescription } : {})
        };
        const message = this.dependencies.assistant.completeRequest(reply);

        const completedResult = message.appliedEdit ? { articleChanged: true } : result;
        return { responseKind: kind, messageId: message.id, ...(artifact.id ? { editorialArtifactId: artifact.id } : {}), ...(completedResult ? { result: completedResult } : {}) };
    }


    private applyPendingActions(request: PreparedAssistantRequest): boolean {
        let metadataChanged = false;
        for (const action of request.pendingActions) {
            this.dependencies.capabilities!
                .executeAction(action.capability, {
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
            createAuthorGuidance: request.authorMessage,
            scope: request.scope,
            responseId: event.responseId,
            proposal: content,
            ...(request.completedCapability === EDITORIAL_CAPABILITY.STYLE_REVIEW
                ? { styleProfile: this.dependencies.styleCorpus.getStyleCorpus().profile, articleStyleRules: this.dependencies.styleCorpus.getArticleStyleRules(request.articleId) }
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
            id: this.dependencies.artifacts.createEditorialArtifact({
                articleId: request.articleId,
                revisionId: request.scope.baseRevisionId,
                kind: "assistant-proposal",
                content: JSON.stringify({ ...metadata, findings: event.styleReview }),
            }).id,
        };
    }


    private getCompletionResult(request: PreparedAssistantRequest, event: CompletionEvent, content: string, factCheck: FactCheck | undefined, metadataChanged: boolean): AssistantEditorialResult | undefined {
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
