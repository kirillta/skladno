import { APPLICATION_ERROR, BUILT_IN_SKILL, builtInSkillScopeCompatibility, FACT_CHECK_STATUS, getPublishLimitProfile, HTTP_STATUS, isPublishLimitProfileId, type AssistantMessage, type AssistantRequestScope, type BuiltInSkillId, type EditorialOperation, type FactCheckFinding } from "@skladno/shared";

import { ApplicationServiceError } from "../errors/application-service-error.js";
import type { ArticleStore } from "../ports/article-store.js";
import type { AssistantStore } from "../ports/assistant-store.js";
import type { EditorialEngine } from "../ports/editorial-engine.js";
import type { EditorialEngineResolver } from "../ports/editorial-engine-resolver.js";
import type { StyleCorpusStore } from "../ports/style-corpus-store.js";
import { capabilityForEditorialOperation, type EditorialCapabilityCatalog } from "./editorial-capability-catalog.js";
import { type AssistantServiceRequest, type FactChecksStore, type PreparedAssistantRequest, type ReplayedAssistantRequest } from "./assistant-service-types.js";


function inferSkill(message: string, requestScope: AssistantRequestScope): BuiltInSkillId | undefined {
    const candidates: [BuiltInSkillId, RegExp][] = [
        [BUILT_IN_SKILL.FACT_CHECKING, /fact.?check|verify|source|citation/],
        [BUILT_IN_SKILL.STYLE_REVIEW, /style|voice|tone/],
        [BUILT_IN_SKILL.TRANSLATION, /translat/],
        [BUILT_IN_SKILL.TALKING_POINTS, /talking points|outline|bullet/],
        [BUILT_IN_SKILL.NARRATIVE_DRAFT, /narrative|write (?:a |the )?draft|turn .* into (?:an? )?article/],
        [BUILT_IN_SKILL.FLOW_AND_CLARITY, /flow|clarity|transition|readability|smooth/],
    ];
    const matched = candidates.filter(([skill, pattern]) => pattern.test(message.toLowerCase()) && builtInSkillScopeCompatibility[skill].includes(requestScope.kind));

    return matched.length === 1 ? matched[0]![0] : undefined;
}


function operationFor(skill: BuiltInSkillId): EditorialOperation {
    const operations: Record<BuiltInSkillId, EditorialOperation> = {
        talking_points: "thesis_to_narrative",
        narrative_draft: "thesis_to_narrative",
        flow_and_clarity: "flow_revision",
        fact_checking: "fact_check",
        style_review: "style_review",
        translation: "translation",
    };

    return operations[skill];
}


export interface AssistantRequestPreparationDependencies {
    articles: ArticleStore;
    assistant: AssistantStore;
    styleCorpus: StyleCorpusStore;
    engines: EditorialEngineResolver;
    factChecks: FactChecksStore;
    capabilities?: EditorialCapabilityCatalog;
}


export class AssistantRequestPreparation {
    constructor(private readonly dependencies: AssistantRequestPreparationDependencies) { }


    listMessages(articleId: string): AssistantMessage[] {
        if (!this.dependencies.articles.get(articleId))
            throw new ApplicationServiceError(APPLICATION_ERROR.ARTICLE_NOT_FOUND, HTTP_STATUS.NOT_FOUND);

        return this.dependencies.assistant.listMessages(articleId);
    }


    prepare(request: AssistantServiceRequest): PreparedAssistantRequest {
        const article = this.dependencies.articles.get(request.articleId);
        if (!article)
            throw new ApplicationServiceError(APPLICATION_ERROR.ARTICLE_NOT_FOUND, HTTP_STATUS.NOT_FOUND);

        const replay = this.replayInput(request);
        const articleContent = article.currentRevision.content;
        this.validatePreparation(replay, article.currentRevisionId, articleContent);

        const routing = this.resolveRequestRouting(replay);
        this.validateResolvedRequest(replay, routing.resolvedSkillId, routing.usesCapabilityLoop);
        const reusableFactFindings = this.reusableFactFindings(article.id, routing.resolvedSkillId);

        return {
            ...replay,
            articleContent,
            articleTitle: article.title,
            ...this.publishingLimit(article.publishingProfileId),
            ...routing,
            capabilityActivities: [],
            pendingActions: [],
            authorizedActions: [],
            ...(!routing.usesCapabilityLoop && routing.resolvedSkillId ? { completedCapability: capabilityForEditorialOperation(routing.operation) } : {}),
            ...(reusableFactFindings.length ? { reusableFactFindings } : {})
        };
    }


    private replayInput(request: AssistantServiceRequest): ReplayedAssistantRequest {
        if (request.kind === "new")
            return request;

        const original = this.dependencies.assistant.getRequest(request.retryOfRequestId);
        if (!original || original.articleId !== request.articleId || (original.status !== "failed" && original.status !== "cancelled"))
            throw new ApplicationServiceError(APPLICATION_ERROR.ASSISTANT_RETRY_INVALID, HTTP_STATUS.BAD_REQUEST);

        return {
            kind: "new",
            requestId: request.requestId,
            authorMessage: original.authorMessage,
            scope: original.scope,
            ...(original.explicitSkillId ? { explicitSkillId: original.explicitSkillId } : {}),
            ...(original.skillOffset === undefined ? {} : { skillOffset: original.skillOffset }),
            ...(original.targetLanguage ? { targetLanguage: original.targetLanguage } : {}),
            retryOfRequestId: original.id,
            articleId: request.articleId,
        };
    }


    private validatePreparation(request: ReplayedAssistantRequest, currentRevisionId: string, articleContent: string): void {
        if (currentRevisionId !== request.scope.baseRevisionId)
            throw new ApplicationServiceError(APPLICATION_ERROR.REVISION_CONFLICT, HTTP_STATUS.CONFLICT);

        if (request.explicitSkillId && !builtInSkillScopeCompatibility[request.explicitSkillId].includes(request.scope.kind))
            throw new ApplicationServiceError(APPLICATION_ERROR.ASSISTANT_SKILL_SCOPE_INCOMPATIBLE, HTTP_STATUS.BAD_REQUEST);

        if (request.scope.kind === "selection" && (request.scope.endOffset > articleContent.length || request.scope.startOffset >= request.scope.endOffset))
            throw new ApplicationServiceError(APPLICATION_ERROR.ASSISTANT_SELECTION_INVALID, HTTP_STATUS.BAD_REQUEST);
    }


    private resolveRequestRouting(request: ReplayedAssistantRequest): { resolvedSkillId?: BuiltInSkillId; operation: EditorialOperation; engine: EditorialEngine; usesCapabilityLoop: boolean } {
        const resolvedSkillId = request.explicitSkillId ?? inferSkill(request.authorMessage, request.scope);
        const operation = operationFor(resolvedSkillId ?? BUILT_IN_SKILL.FLOW_AND_CLARITY);
        const engine = this.resolveEngine(operation, resolvedSkillId);
        const usesCapabilityLoop = Boolean(engine.streamAssistant && this.dependencies.capabilities);

        return { resolvedSkillId, operation, engine, usesCapabilityLoop };
    }


    private resolveEngine(operation: EditorialOperation, skillId?: BuiltInSkillId): EditorialEngine {
        const engine = this.dependencies.engines.resolve(operation, skillId);
        if (!engine)
            throw new ApplicationServiceError(APPLICATION_ERROR.EDITORIAL_CONFIGURATION_MISSING, HTTP_STATUS.BAD_REQUEST);

        return engine;
    }


    private validateResolvedRequest(request: ReplayedAssistantRequest, resolvedSkillId: BuiltInSkillId | undefined, usesCapabilityLoop: boolean): void {
        if (!usesCapabilityLoop && resolvedSkillId === BUILT_IN_SKILL.TRANSLATION && !request.targetLanguage?.trim())
            throw new ApplicationServiceError(APPLICATION_ERROR.TARGET_LANGUAGE_REQUIRED, HTTP_STATUS.BAD_REQUEST);

        if (resolvedSkillId === BUILT_IN_SKILL.STYLE_REVIEW && this.dependencies.styleCorpus.get().status !== "ready")
            throw new ApplicationServiceError(APPLICATION_ERROR.STYLE_CORPUS_REQUIRED, HTTP_STATUS.BAD_REQUEST);
    }


    private publishingLimit(publishingProfileId?: string): { publishingCharacterLimit?: number } {
        return isPublishLimitProfileId(publishingProfileId)
            ? { publishingCharacterLimit: getPublishLimitProfile(publishingProfileId).characterLimit }
            : {};
    }


    private reusableFactFindings(articleId: string, skillId?: BuiltInSkillId): FactCheckFinding[] {
        if (skillId !== BUILT_IN_SKILL.FACT_CHECKING)
            return [];

        return this.dependencies.factChecks.list(articleId).flatMap((factCheck) => factCheck.findings
            .filter((finding) => finding.status === FACT_CHECK_STATUS.SUPPORTED)
            .map((finding) => ({ ...finding, reusedFromRevisionId: factCheck.reviewedRevisionId })));
    }
}
