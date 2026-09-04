import { APPLICATION_ERROR, BUILT_IN_SKILL, HTTP_STATUS, type BuiltInSkillId } from "@skladno/shared";

import { ApplicationServiceError } from "../errors/application-service-error.js";
import type { AssistantStore } from "../ports/assistant-store.js";
import { EDITORIAL_ENGINE_EVENT } from "../ports/editorial-engine-events.js";
import { EDITORIAL_ENGINE_ERROR } from "../ports/editorial-engine-errors.js";
import { EditorialEngineError } from "../ports/editorial-engine-error.js";
import type { EditorialEngineEvent } from "../ports/editorial-engine-event.js";
import type { EditorialEngineResolver } from "../ports/editorial-engine-resolver.js";
import type { EditorialAssistantTool } from "../ports/editorial-assistant-request.js";
import { builtInSkillPackages } from "./built-in-skill-packages.js";
import { EDITORIAL_CAPABILITY, isValidatedEditorialCapabilityCall, type EditorialCapabilityCatalog, type EditorialCapabilityDefinition, type StreamContext } from "./editorial-capability-catalog.js";
import { type ActionCapability, type CompletionEvent, type ConversationHistory, type PreparedAssistantRequest, type ReadCapability } from "./assistant-service-types.js";


function isTransientReadFailure(error: unknown): boolean {
    return error instanceof ApplicationServiceError && error.code === APPLICATION_ERROR.EDITORIAL_PROVIDER_FAILED;
}


export interface AssistantCapabilityLoopDependencies {
    assistant: AssistantStore;
    engines: EditorialEngineResolver;
    capabilities?: EditorialCapabilityCatalog;
    conversationHistory: (articleId: string, limit?: number) => ConversationHistory;
}


export class AssistantCapabilityLoop {
    constructor(private readonly dependencies: AssistantCapabilityLoopDependencies) { }


    async *stream(request: PreparedAssistantRequest, signal: AbortSignal): AsyncIterable<EditorialEngineEvent> {
        if (!request.engine.streamAssistant || !this.dependencies.capabilities)
            throw new EditorialEngineError(EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT, EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT);

        const excerpt = this.articleExcerpt(request);
        let primary: CompletionEvent | undefined;
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
            history: this.dependencies.conversationHistory(request.articleId, 12),
            skills: builtInSkillPackages.map((skillPackage) => ({ id: skillPackage.reference.id, name: skillPackage.name, description: skillPackage.description, instructions: skillPackage.instructions })),
            tools,
            ...(request.explicitSkillId ? { initialActiveCapabilities: this.initialCapabilities(request.explicitSkillId) } : {}),
        }, signal)) {
            if (event.type === EDITORIAL_ENGINE_EVENT.COMPLETED && primary)
                yield primary;
            else
                yield event;
        }
    }


    private articleExcerpt(request: PreparedAssistantRequest): string {
        return request.scope.kind === "selection"
            ? request.articleContent.slice(request.scope.startOffset, request.scope.endOffset)
            : request.articleContent;
    }


    private initialCapabilities(skill: BuiltInSkillId): readonly string[] {
        if (skill === BUILT_IN_SKILL.FACT_CHECKING)
            return [EDITORIAL_CAPABILITY.FACT_CHECK, EDITORIAL_CAPABILITY.INSPECT_FACT_CHECKS];

        if (skill === BUILT_IN_SKILL.STYLE_REVIEW)
            return [EDITORIAL_CAPABILITY.STYLE_REVIEW, EDITORIAL_CAPABILITY.INSPECT_STYLE_CORPUS, EDITORIAL_CAPABILITY.INSPECT_ARTICLE_STYLE_RULES];

        if (skill === BUILT_IN_SKILL.TRANSLATION)
            return [EDITORIAL_CAPABILITY.TRANSLATE, EDITORIAL_CAPABILITY.INSPECT_TRANSLATIONS];

        return [EDITORIAL_CAPABILITY.GENERATE_PROPOSAL];
    }


    private capabilityTools(request: PreparedAssistantRequest, excerpt: string, primary: () => CompletionEvent | undefined, setPrimary: (event: CompletionEvent) => void): EditorialAssistantTool[] {
        if (!this.dependencies.capabilities)
            return [];

        const definitions = request.scope.kind === "selection"
            ? this.dependencies.capabilities.definitions().filter((definition) => definition.execution === "artifact" && definition.selectionCompatible)
            : this.dependencies.capabilities.definitions();
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
            execute: async (input) => this.dependencies.capabilities!.discover(input.query ?? "", request.scope.kind),
        });

        return tools;
    }


    private async executeCapability(request: PreparedAssistantRequest, excerpt: string, definition: EditorialCapabilityDefinition, input: Readonly<Record<string, string>>, signal: AbortSignal, primary: () => CompletionEvent | undefined, setPrimary: (event: CompletionEvent) => void): Promise<unknown> {
        if (!isValidatedEditorialCapabilityCall(definition.id, input))
            throw new EditorialEngineError(EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT, EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT);

        request.capabilityActivities.push({ summary: definition.activity, status: "started" });
        this.dependencies.assistant.setExecution(request.requestId, definition.id);

        if (definition.execution === "read")
            return this.executeReadCapability(request, definition, input);

        if (definition.execution === "action")
            return this.stageAction(request, definition, input, signal);

        return this.streamArtifactCapability(request, excerpt, definition, input, signal, primary, setPrimary);
    }


    private executeReadCapability(request: PreparedAssistantRequest, definition: EditorialCapabilityDefinition, input: Readonly<Record<string, string>>): unknown {
        const read = () => this.dependencies.capabilities!.read({
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
        const verifier = this.dependencies.engines.resolveAssistantActionIntentVerifier?.();
        if (!verifier || !await verifier.verify(request.authorMessage, action, input, signal))
            throw new ApplicationServiceError(APPLICATION_ERROR.INVALID_REQUEST, HTTP_STATUS.BAD_REQUEST);

        request.authorizedActions = [...request.authorizedActions, action];
        request.pendingActions.push({ capability: action, input });
        this.completeCapability(request, definition);

        return { status: "staged" };
    }


    private async streamArtifactCapability(request: PreparedAssistantRequest, excerpt: string, definition: EditorialCapabilityDefinition, input: Readonly<Record<string, string>>, signal: AbortSignal, primary: () => CompletionEvent | undefined, setPrimary: (event: CompletionEvent) => void): Promise<{ status: "prepared" }> {
        const stream = this.dependencies.capabilities!.stream({
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
        this.dependencies.assistant.setExecution(request.requestId, definition.id, "completed");
    }
}
