import { APPLICATION_ERROR, ASSISTANT_EVENT, HTTP_STATUS, type AssistantEditorialResult, type AssistantEvent, type AssistantResponseKind, type FactCheck } from "@skladno/shared";
import { createHash } from "node:crypto";

import { ApplicationServiceError } from "../errors/application-service-error.js";
import type { AssistantArtifactStore } from "../ports/assistant-artifact-store.js";
import type { ArticleStore } from "../ports/article-store.js";
import type { AssistantStore } from "../ports/assistant-store.js";
import { EDITORIAL_CAPABILITY } from "./editorial-capability-catalog.js";
import type { EditorialCapabilityCatalog } from "./editorial-capability-catalog.js";
import type { StyleCorpusStore } from "../ports/style-corpus-store.js";
import { type CompletionEvent, type FactChecksStore, type PreparedAssistantRequest } from "./assistant-service-types.js";


function completedContent(request: PreparedAssistantRequest, text: string): string {
    if (request.scope.kind !== "selection" || !request.completedCapability || request.completedCapability === EDITORIAL_CAPABILITY.FACT_CHECK)
        return text;

    return `${request.articleContent.slice(0, request.scope.startOffset)}${text}${request.articleContent.slice(request.scope.endOffset)}`;
}


export function responseKind(capability?: string): AssistantResponseKind {
    if (capability === EDITORIAL_CAPABILITY.FACT_CHECK)
        return "findings_prepared";

    if (capability === EDITORIAL_CAPABILITY.STYLE_REVIEW)
        return "proposal_and_findings_prepared";

    if (capability === EDITORIAL_CAPABILITY.TRANSLATE)
        return "translation_proposal_prepared";

    if (capability === EDITORIAL_CAPABILITY.GENERATE_PROPOSAL)
        return "proposal_prepared";

    return "editorial_conversation";
}


function enrichedFactCheck(factCheck: FactCheck, revisionId: string): FactCheck {
    const checkedAt = new Date().toISOString();
    return {
        ...factCheck,
        reviewedRevisionId: revisionId,
        createdAt: checkedAt,
        findings: factCheck.findings.map((finding) => {
            const factId = createHash("sha256").update(finding.claim.trim().toLowerCase().replace(/\s+/g, " ")).digest("hex").slice(0, 16);
            return { ...finding, factId, occurrenceId: `${revisionId}:${factId}`, checkedAt };
        }),
    };
}


export interface AssistantCompletionDependencies {
    articles: ArticleStore;
    assistant: AssistantStore;
    styleCorpus: StyleCorpusStore;
    artifacts: AssistantArtifactStore;
    factChecks: FactChecksStore;
    capabilities?: EditorialCapabilityCatalog;
}


export class AssistantCompletion {
    constructor(private readonly dependencies: AssistantCompletionDependencies) { }


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
        const factCheck = event.factCheck && enrichedFactCheck(event.factCheck, request.scope.baseRevisionId);
        const artifactId = this.createCompletionArtifact(request, event, content, factCheck);
        if (artifactId && factCheck)
            this.dependencies.factChecks.save(artifactId, request.articleId, request.scope.baseRevisionId);

        const result = this.completionResult(request, event, content, factCheck, metadataChanged);
        const message = this.dependencies.assistant.completeRequest({
            requestId: request.requestId,
            articleId: request.articleId,
            ...(request.resolvedSkillId ? { skillId: request.resolvedSkillId } : {}),
            responseKind: kind,
            content: request.completedCapability ? "" : content,
            proposalContent: result?.proposal,
            editorialArtifactId: artifactId
        });

        return { responseKind: kind, messageId: message.id, ...(artifactId ? { editorialArtifactId: artifactId } : {}), ...(result ? { result } : {}) };
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

            metadataChanged ||= action.capability === EDITORIAL_CAPABILITY.RENAME_ARTICLE
                || action.capability === EDITORIAL_CAPABILITY.CHANGE_ARTICLE_LANGUAGE
                || action.capability === EDITORIAL_CAPABILITY.ASSIGN_PUBLISHING_PROFILE
                || action.capability === EDITORIAL_CAPABILITY.SET_ARTICLE_STYLE_RULES;
        }

        return metadataChanged;
    }


    private createCompletionArtifact(request: PreparedAssistantRequest, event: CompletionEvent, content: string, factCheck: FactCheck | undefined): string | undefined {
        if (!request.completedCapability)
            return undefined;

        return this.dependencies.artifacts.create({
            articleId: request.articleId,
            revisionId: request.scope.baseRevisionId,
            kind: request.completedCapability === EDITORIAL_CAPABILITY.FACT_CHECK ? "fact-check" : "assistant-proposal",
            content: JSON.stringify({
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
                ...(factCheck ? { factCheck } : { findings: event.styleReview }),
                translation: event.translation
            })
        }).id;
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
