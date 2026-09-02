import { APPLICATION_ERROR, ASSISTANT_EVENT, BUILT_IN_SKILL, builtInSkillScopeCompatibility, EDITORIAL_OPERATION, FACT_CHECK_STATUS, getPublishLimitProfile, HTTP_STATUS, isPublishLimitProfileId, type AssistantAuthorizedAction, type AssistantEditorialResult, type AssistantEvent, type AssistantMessage, type AssistantRequestScope, type AssistantResponseKind, type BuiltInSkillId, type EditorialOperation, type FactCheck, type FactCheckFinding, type StartAssistantRequest } from "@skladno/shared";
import { createHash } from "node:crypto";

import { ApplicationServiceError } from "../errors/application-service-error.js";
import { activityForEditorialOperation, capabilityForEditorialOperation, EDITORIAL_CAPABILITY, isValidatedEditorialCapabilityCall, type EditorialCapabilityCatalog, type EditorialCapabilityDefinition, type EditorialCapabilityId, type StreamContext } from "./editorial-capability-catalog.js";
import type { EditorialAssistantTool } from "../ports/editorial-assistant-request.js";
import { builtInSkillPackages } from "./built-in-skill-packages.js";
import type { ArticleStore } from "../ports/article-store.js";
import type { AssistantArtifactStore } from "../ports/assistant-artifact-store.js";
import type { AssistantStore } from "../ports/assistant-store.js";
import { EDITORIAL_ENGINE_EVENT } from "../ports/editorial-engine-events.js";
import { EDITORIAL_ENGINE_ERROR } from "../ports/editorial-engine-errors.js";
import { EditorialEngineError } from "../ports/editorial-engine-error.js";
import type { EditorialEngine } from "../ports/editorial-engine.js";
import type { EditorialEngineEvent } from "../ports/editorial-engine-event.js";
import type { EditorialEngineResolver } from "../ports/editorial-engine-resolver.js";
import type { StyleCorpusStore } from "../ports/style-corpus-store.js";


type ReadCapability = Extract<EditorialCapabilityId, "inspect_article" | "inspect_linked_articles" | "inspect_revisions" | "inspect_draft" | "inspect_artifacts" | "inspect_proposal_summary" | "inspect_fact_checks" | "inspect_publishing_guidance" | "inspect_style_corpus" | "inspect_article_style_rules" | "inspect_translations">;
type ActionCapability = Extract<EditorialCapabilityId, "rename_article" | "change_article_language" | "assign_publishing_profile" | "set_article_style_rules" | "add_revision_to_style_corpus" | "rebuild_style_profile">;
type CompletionEvent = Extract<EditorialEngineEvent, { type: typeof EDITORIAL_ENGINE_EVENT.COMPLETED }>;


export interface AssistantServiceRequest extends StartAssistantRequest {
    articleId: string;
}


export interface PreparedAssistantRequest extends AssistantServiceRequest {
    articleContent: string;
    publishingCharacterLimit?: number;
    resolvedSkillId?: BuiltInSkillId;
    operation: EditorialOperation;
    engine: EditorialEngine;
    reusableFactFindings?: FactCheckFinding[];
    usesCapabilityLoop: boolean;
    completedCapability?: string;
    capabilityActivities: { summary: string; status: "started" | "completed" }[];
    pendingActions: { capability: ActionCapability; input: Readonly<Record<string, string>> }[];
    authorizedActions: readonly AssistantAuthorizedAction[];
}


interface FactChecksStore {
    list(articleId: string): FactCheck[];
    save(artifactId: string, articleId: string, revisionId: string): void;
}


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


function initialCapabilities(skill?: BuiltInSkillId): readonly string[] | undefined {
    if (!skill)
        return undefined;

    if (skill === BUILT_IN_SKILL.FACT_CHECKING)
        return [EDITORIAL_CAPABILITY.FACT_CHECK, EDITORIAL_CAPABILITY.INSPECT_FACT_CHECKS];

    if (skill === BUILT_IN_SKILL.STYLE_REVIEW)
        return [EDITORIAL_CAPABILITY.STYLE_REVIEW, EDITORIAL_CAPABILITY.INSPECT_STYLE_CORPUS, EDITORIAL_CAPABILITY.INSPECT_ARTICLE_STYLE_RULES];

    if (skill === BUILT_IN_SKILL.TRANSLATION)
        return [EDITORIAL_CAPABILITY.TRANSLATE, EDITORIAL_CAPABILITY.INSPECT_TRANSLATIONS];

    return [EDITORIAL_CAPABILITY.GENERATE_PROPOSAL];
}


function isTransientReadFailure(error: unknown): boolean {
    return error instanceof ApplicationServiceError && error.code === APPLICATION_ERROR.EDITORIAL_PROVIDER_FAILED;
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


function responseKind(capability?: string): AssistantResponseKind {
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


function completedContent(request: PreparedAssistantRequest, text: string): string {
    if (request.scope.kind !== "selection" || !request.completedCapability || request.completedCapability === EDITORIAL_CAPABILITY.FACT_CHECK)
        return text;

    return `${request.articleContent.slice(0, request.scope.startOffset)}${text}${request.articleContent.slice(request.scope.endOffset)}`;
}


function errorCode(error: unknown): typeof APPLICATION_ERROR.EDITORIAL_STREAM_INCOMPLETE | typeof APPLICATION_ERROR.EDITORIAL_PROVIDER_FAILED {
    return error instanceof EditorialEngineError && error.code === EDITORIAL_ENGINE_ERROR.INCOMPLETE_STREAM
        ? APPLICATION_ERROR.EDITORIAL_STREAM_INCOMPLETE
        : APPLICATION_ERROR.EDITORIAL_PROVIDER_FAILED;
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


export class AssistantService {
    constructor(
        private readonly articles: ArticleStore,
        private readonly assistant: AssistantStore,
        private readonly styleCorpus: StyleCorpusStore,
        private readonly artifacts: AssistantArtifactStore,
        private readonly engines: EditorialEngineResolver,
        private readonly factChecks: FactChecksStore = { list: () => [], save: () => undefined },
        private readonly capabilities?: EditorialCapabilityCatalog,
    ) { }


    listMessages(articleId: string): AssistantMessage[] {
        if (!this.articles.get(articleId))
            throw new ApplicationServiceError(APPLICATION_ERROR.ARTICLE_NOT_FOUND, HTTP_STATUS.NOT_FOUND);

        return this.assistant.listMessages(articleId);
    }


    prepare(request: AssistantServiceRequest): PreparedAssistantRequest {
        const article = this.articles.get(request.articleId);
        if (!article)
            throw new ApplicationServiceError(APPLICATION_ERROR.ARTICLE_NOT_FOUND, HTTP_STATUS.NOT_FOUND);

        const articleContent = article.currentRevision.content;
        this.validatePreparation(request, article.currentRevisionId, articleContent);

        const routing = this.resolveRequestRouting(request);
        this.validateResolvedRequest(request, routing.resolvedSkillId);
        const reusableFactFindings = this.reusableFactFindings(article.id, routing.resolvedSkillId);

        return {
            ...request,
            articleContent,
            ...this.publishingLimit(article.publishingProfileId),
            ...routing,
            capabilityActivities: [],
            pendingActions: [],
            authorizedActions: [],
            ...(!routing.usesCapabilityLoop && routing.resolvedSkillId ? { completedCapability: capabilityForEditorialOperation(routing.operation) } : {}),
            ...(reusableFactFindings.length ? { reusableFactFindings } : {})
        };
    }


    private validatePreparation(request: AssistantServiceRequest, currentRevisionId: string, articleContent: string): void {
        if (currentRevisionId !== request.scope.baseRevisionId)
            throw new ApplicationServiceError(APPLICATION_ERROR.REVISION_CONFLICT, HTTP_STATUS.CONFLICT);

        if (request.explicitSkillId && !builtInSkillScopeCompatibility[request.explicitSkillId].includes(request.scope.kind))
            throw new ApplicationServiceError(APPLICATION_ERROR.ASSISTANT_SKILL_SCOPE_INCOMPATIBLE, HTTP_STATUS.BAD_REQUEST);

        if (request.retryOfRequestId && !this.assistant.getRequest(request.retryOfRequestId))
            throw new ApplicationServiceError(APPLICATION_ERROR.ASSISTANT_RETRY_INVALID, HTTP_STATUS.BAD_REQUEST);

        if (request.scope.kind === "selection" && request.scope.endOffset > articleContent.length)
            throw new ApplicationServiceError(APPLICATION_ERROR.ASSISTANT_SELECTION_INVALID, HTTP_STATUS.BAD_REQUEST);
    }


    private resolveRequestRouting(request: AssistantServiceRequest): { resolvedSkillId?: BuiltInSkillId; operation: EditorialOperation; engine: EditorialEngine; usesCapabilityLoop: boolean } {
        let fallbackSkillId = request.explicitSkillId;
        let operation: EditorialOperation = EDITORIAL_OPERATION.FLOW_REVISION;
        let engine = this.resolveEngine(operation, fallbackSkillId);
        const usesCapabilityLoop = Boolean(engine.streamAssistant && this.capabilities);
        if (!usesCapabilityLoop) {
            fallbackSkillId = request.explicitSkillId ?? inferSkill(request.authorMessage, request.scope);
            operation = operationFor(fallbackSkillId ?? BUILT_IN_SKILL.FLOW_AND_CLARITY);
            engine = this.resolveEngine(operation, fallbackSkillId);
        }

        return { resolvedSkillId: usesCapabilityLoop ? request.explicitSkillId : fallbackSkillId, operation, engine, usesCapabilityLoop };
    }


    private resolveEngine(operation: EditorialOperation, skillId?: BuiltInSkillId): EditorialEngine {
        const engine = this.engines.resolve(operation, skillId);
        if (!engine)
            throw new ApplicationServiceError(APPLICATION_ERROR.EDITORIAL_CONFIGURATION_MISSING, HTTP_STATUS.BAD_REQUEST);

        return engine;
    }


    private validateResolvedRequest(request: AssistantServiceRequest, resolvedSkillId?: BuiltInSkillId): void {
        if (resolvedSkillId === BUILT_IN_SKILL.TRANSLATION && !request.targetLanguage?.trim())
            throw new ApplicationServiceError(APPLICATION_ERROR.TARGET_LANGUAGE_REQUIRED, HTTP_STATUS.BAD_REQUEST);

        if (resolvedSkillId === BUILT_IN_SKILL.STYLE_REVIEW && this.styleCorpus.get().status !== "ready")
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

        return this.factChecks.list(articleId).flatMap((factCheck) => factCheck.findings
            .filter((finding) => finding.status === FACT_CHECK_STATUS.SUPPORTED)
            .map((finding) => ({ ...finding, reusedFromRevisionId: factCheck.reviewedRevisionId })));
    }


    async *stream(request: PreparedAssistantRequest, signal: AbortSignal): AsyncIterable<AssistantEvent> {
        this.initializeRequest(request);
        yield* this.initialEvents(request);

        let completed = false;
        try {
            for await (const event of this.editorialStream(request, signal)) {
                completed ||= event.type === EDITORIAL_ENGINE_EVENT.COMPLETED;
                yield* this.assistantEvents(request, event);
            }

            if (!completed && !signal.aborted)
                throw new EditorialEngineError(EDITORIAL_ENGINE_ERROR.INCOMPLETE_STREAM, EDITORIAL_ENGINE_ERROR.INCOMPLETE_STREAM);
        } catch (error) {
            this.assistant.failRequest(request.requestId, signal.aborted ? "cancelled" : "failed", signal.aborted ? "request_cancelled" : errorCode(error));
            throw error;
        }

        if (signal.aborted)
            this.assistant.failRequest(request.requestId, "cancelled", "request_cancelled");
    }


    private initializeRequest(request: PreparedAssistantRequest): void {
        this.assistant.createRequest({
            id: request.requestId,
            articleId: request.articleId,
            scope: request.scope,
            explicitSkillId: request.explicitSkillId,
            skillOffset: request.skillOffset,
            retryOfRequestId: request.retryOfRequestId
        });
        this.assistant.setAuthorMessage(request.requestId, request.authorMessage);
        this.assistant.resolveRequest(request.requestId, request.resolvedSkillId, request.explicitSkillId ? "explicit" : request.resolvedSkillId ? "inferred" : undefined);
    }


    private initialEvents(request: PreparedAssistantRequest): AssistantEvent[] {
        return [
            { type: ASSISTANT_EVENT.ACCEPTED, requestId: request.requestId },
            {
                type: ASSISTANT_EVENT.SKILL_RESOLVED,
                requestId: request.requestId,
                ...(request.resolvedSkillId ? { skillId: request.resolvedSkillId, source: request.explicitSkillId ? "explicit" : "inferred" } : {})
            },
            ...(!request.usesCapabilityLoop ? [{ type: ASSISTANT_EVENT.CAPABILITY_ACTIVITY, requestId: request.requestId, activity: { summary: activityForEditorialOperation(request.operation), status: "started" as const } }] : [])
        ];
    }


    private editorialStream(request: PreparedAssistantRequest, signal: AbortSignal): AsyncIterable<EditorialEngineEvent> {
        return request.usesCapabilityLoop ? this.capabilityLoopStream(request, signal) : this.engineStream(request, signal);
    }


    private async *assistantEvents(request: PreparedAssistantRequest, event: EditorialEngineEvent): AsyncIterable<AssistantEvent> {
        if (event.type === EDITORIAL_ENGINE_EVENT.TEXT_DELTA)
            yield { type: ASSISTANT_EVENT.TEXT_DELTA, requestId: request.requestId, delta: event.delta };

        if (event.type === EDITORIAL_ENGINE_EVENT.TOOL_STATUS)
            yield { type: ASSISTANT_EVENT.TOOL_STATUS, requestId: request.requestId, tool: event.tool, status: event.status, ...(event.claims ? { claims: event.claims } : {}) };

        if (event.type !== EDITORIAL_ENGINE_EVENT.COMPLETED)
            return;

        const kind = responseKind(request.completedCapability);
        for (const activity of request.capabilityActivities)
            yield { type: ASSISTANT_EVENT.CAPABILITY_ACTIVITY, requestId: request.requestId, activity };

        yield { type: ASSISTANT_EVENT.STAGED_COMPLETION, requestId: request.requestId, completion: { responseKind: kind } };
        const completion = this.persistCompletion(request, event);
        if (!request.usesCapabilityLoop)
            yield { type: ASSISTANT_EVENT.CAPABILITY_ACTIVITY, requestId: request.requestId, activity: { summary: activityForEditorialOperation(request.operation), status: "completed" } };

        yield { type: ASSISTANT_EVENT.COMPLETED, requestId: request.requestId, ...completion };
    }


    private engineStream(request: PreparedAssistantRequest, signal: AbortSignal): AsyncIterable<EditorialEngineEvent> {
        const excerpt = this.articleExcerpt(request);
        if (request.resolvedSkillId)
            return request.engine.stream(this.engineRequest(request, excerpt), signal);

        return request.engine.streamConversation({ message: request.authorMessage, article: excerpt, scope: request.scope.kind, history: this.conversationHistory(request.articleId) }, signal);
    }


    private articleExcerpt(request: PreparedAssistantRequest): string {
        return request.scope.kind === "selection"
            ? request.articleContent.slice(request.scope.startOffset, request.scope.endOffset)
            : request.articleContent;
    }


    private engineRequest(request: PreparedAssistantRequest, excerpt: string) {
        return {
            operation: request.operation,
            article: excerpt,
            ...(request.scope.kind === "selection" ? { articleSelection: true } : {}),
            authorContext: request.authorMessage,
            skillId: request.resolvedSkillId!,
            ...(request.scope.kind === "selection" ? { surroundingArticleCharacterCount: request.articleContent.length - excerpt.length } : {}),
            ...(request.publishingCharacterLimit ? { targetArticleCharacterLimit: request.publishingCharacterLimit } : {}),
            ...(request.targetLanguage ? { targetLanguage: request.targetLanguage } : {}),
            ...(request.resolvedSkillId === BUILT_IN_SKILL.STYLE_REVIEW
                ? { styleProfile: this.styleCorpus.get().profile, articleStyleRules: this.styleCorpus.getArticleRules(request.articleId) }
                : {}
            ),
            ...(request.reusableFactFindings ? { reusableFactFindings: request.reusableFactFindings } : {})
        };
    }


    private conversationHistory(articleId: string, limit?: number): { role: "author" | "assistant"; content: string }[] {
        const history = this.assistant.listMessages(articleId).flatMap((message) => {
            const isHistoryMessage = message.role === "author" || (message.role === "assistant" && message.kind === "response");
            if (!isHistoryMessage || !message.content)
                return [];

            return [{ role: message.role === "author" ? "author" as const : "assistant" as const, content: message.content }];
        });

        return limit === undefined ? history : history.slice(-limit);
    }


    private async *capabilityLoopStream(request: PreparedAssistantRequest, signal: AbortSignal): AsyncIterable<EditorialEngineEvent> {
        if (!request.engine.streamAssistant || !this.capabilities)
            throw new EditorialEngineError(EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT, EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT);

        const excerpt = this.articleExcerpt(request);
        let primary: Extract<EditorialEngineEvent, { type: typeof EDITORIAL_ENGINE_EVENT.COMPLETED }> | undefined;
        const tools = this.capabilityTools(request, excerpt, () => primary, (event) => {
            primary = event;
        });

        for await (const event of request.engine.streamAssistant({
            message: request.authorMessage,
            article: excerpt,
            scope: request.scope.kind,
            instructions: request.explicitSkillId
                ? builtInSkillPackages.filter((skillPackage) => skillPackage.reference.id === request.explicitSkillId).map((skillPackage) => skillPackage.instructions)
                : [],
            history: this.conversationHistory(request.articleId, 12),
            skills: builtInSkillPackages.map((skillPackage) => ({ id: skillPackage.reference.id, name: skillPackage.name, description: skillPackage.description, instructions: skillPackage.instructions })),
            tools,
            ...(request.explicitSkillId ? { initialActiveCapabilities: initialCapabilities(request.explicitSkillId) } : {}),
        }, signal)) {
            if (event.type === EDITORIAL_ENGINE_EVENT.COMPLETED && primary)
                yield primary;
            else
                yield event;
        }
    }


    private capabilityTools(request: PreparedAssistantRequest, excerpt: string, primary: () => CompletionEvent | undefined, setPrimary: (event: CompletionEvent) => void): EditorialAssistantTool[] {
        if (!this.capabilities)
            return [];

        const definitions = request.scope.kind === "selection"
            ? this.capabilities.definitions().filter((definition) => definition.execution === "artifact" && definition.selectionCompatible)
            : this.capabilities.definitions();
        const tools: EditorialAssistantTool[] = definitions.map((definition) => ({
            capability: definition.id,
            description: definition.activity,
            input: definition.input,
            execute: (input, signal) => this.executeCapability(request, excerpt, definition, input, signal, primary, setPrimary),
        }));
        tools.push({
            capability: "find_capabilities",
            description: "Find only classified Skladno Editorial capabilities, Workspace handoffs, or exclusions for the requested outcome.",
            input: "capability-query",
            execute: async (input) => this.capabilities!.discover(input.query ?? "", request.scope.kind),
        });

        return tools;
    }


    private async executeCapability(request: PreparedAssistantRequest, excerpt: string, definition: EditorialCapabilityDefinition, input: Readonly<Record<string, string>>, signal: AbortSignal, primary: () => CompletionEvent | undefined, setPrimary: (event: CompletionEvent) => void): Promise<unknown> {
        if (!isValidatedEditorialCapabilityCall(definition.id, input))
            throw new EditorialEngineError(EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT, EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT);

        request.capabilityActivities.push({ summary: definition.activity, status: "started" });
        this.assistant.setExecution(request.requestId, definition.id);

        if (definition.execution === "read")
            return this.executeReadCapability(request, definition, input);

        if (definition.execution === "action")
            return this.stageAction(request, definition, input, signal);

        return this.streamArtifactCapability(request, excerpt, definition, input, signal, primary, setPrimary);
    }


    private executeReadCapability(request: PreparedAssistantRequest, definition: EditorialCapabilityDefinition, input: Readonly<Record<string, string>>): unknown {
        const read = () => this.capabilities!.read({
            capability: definition.id as ReadCapability,
            context: { articleId: request.articleId, baseRevisionId: request.scope.baseRevisionId },
            input,
        });

        let result: unknown;
        try {
            result = read();
        } catch (error) {
            if (definition.retry !== "transient-read" || !isTransientReadFailure(error))
                throw error;

            result = read();
        }

        this.completeCapability(request, definition);
        return result;
    }


    private async stageAction(request: PreparedAssistantRequest, definition: EditorialCapabilityDefinition, input: Readonly<Record<string, string>>, signal: AbortSignal): Promise<{ status: "staged" }> {
        const action = definition.id as ActionCapability;
        const verifier = this.engines.resolveAssistantActionIntentVerifier?.();
        if (!verifier || !await verifier.verify(request.authorMessage, action, input, signal))
            throw new ApplicationServiceError(APPLICATION_ERROR.INVALID_REQUEST, HTTP_STATUS.BAD_REQUEST);

        request.authorizedActions = [...request.authorizedActions, action];
        request.pendingActions.push({ capability: action, input });
        this.completeCapability(request, definition);
        return { status: "staged" };
    }


    private async streamArtifactCapability(request: PreparedAssistantRequest, excerpt: string, definition: EditorialCapabilityDefinition, input: Readonly<Record<string, string>>, signal: AbortSignal, primary: () => CompletionEvent | undefined, setPrimary: (event: CompletionEvent) => void): Promise<{ status: "prepared" }> {
        const stream = this.capabilities!.stream({
            capability: definition.id as StreamContext["capability"],
            context: { articleId: request.articleId, baseRevisionId: request.scope.baseRevisionId },
            requestId: request.requestId,
            authorContext: request.authorMessage,
            ...(input.operation ? { operation: input.operation as StreamContext["operation"] } : {}),
            ...(input.targetLanguage ? { targetLanguage: input.targetLanguage } : {}),
            ...(input.findingIds ? { findingIds: input.findingIds } : {}),
            ...(request.scope.kind === "selection" ? { articleContent: excerpt, articleSelection: true, surroundingArticleCharacterCount: request.articleContent.length - excerpt.length } : {}),
        }, signal, true);

        for await (const event of stream) {
            if (event.type !== EDITORIAL_ENGINE_EVENT.COMPLETED)
                continue;

            if (primary())
                throw new EditorialEngineError(EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT, EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT);

            request.completedCapability = definition.id;
            setPrimary(event);
        }

        this.completeCapability(request, definition);
        return { status: "prepared" };
    }


    private completeCapability(request: PreparedAssistantRequest, definition: EditorialCapabilityDefinition): void {
        request.capabilityActivities.push({ summary: definition.activity, status: "completed" });
        this.assistant.setExecution(request.requestId, definition.id, "completed");
    }


    private persistCompletion(request: PreparedAssistantRequest, event: CompletionEvent): Omit<Extract<AssistantEvent, { type: typeof ASSISTANT_EVENT.COMPLETED }>, "type" | "requestId"> {
        return this.assistant.completeRun(() => this.persistCompletionInTransaction(request, event));
    }


    private persistCompletionInTransaction(request: PreparedAssistantRequest, event: CompletionEvent): Omit<Extract<AssistantEvent, { type: typeof ASSISTANT_EVENT.COMPLETED }>, "type" | "requestId"> {
        const article = this.articles.get(request.articleId);
        if (!article || article.currentRevisionId !== request.scope.baseRevisionId)
            throw new ApplicationServiceError(APPLICATION_ERROR.REVISION_CONFLICT, HTTP_STATUS.CONFLICT);

        const metadataChanged = this.applyPendingActions(request);

        const content = completedContent(request, event.text);
        const kind = responseKind(request.completedCapability);
        const factCheck = event.factCheck && enrichedFactCheck(event.factCheck, request.scope.baseRevisionId);
        const artifactId = this.createCompletionArtifact(request, event, content, factCheck);
        if (artifactId && factCheck)
            this.factChecks.save(artifactId, request.articleId, request.scope.baseRevisionId);

        const result = this.completionResult(request, event, content, factCheck, metadataChanged);

        const message = this.assistant.completeRequest({
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
            this.capabilities!.action(action.capability, { articleId: request.articleId, baseRevisionId: request.scope.baseRevisionId, authorizedActions: request.authorizedActions }, action.input);
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

        return this.artifacts.create({
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
                ...(request.completedCapability === EDITORIAL_CAPABILITY.STYLE_REVIEW ? { styleProfile: this.styleCorpus.get().profile, articleStyleRules: this.styleCorpus.getArticleRules(request.articleId) } : {}),
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
