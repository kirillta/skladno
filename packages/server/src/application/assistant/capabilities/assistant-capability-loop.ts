import { APPLICATION_ERROR, BUILT_IN_SKILL, HTTP_STATUS, isBuiltInSkillId } from "@skladno/shared";

import { ApplicationServiceError } from "../../errors/application-service-error.js";
import { EDITORIAL_ENGINE_EVENT } from "../../editorial/engine/editorial-engine-events.js";
import { EDITORIAL_ENGINE_ERROR } from "../../editorial/engine/editorial-engine-errors.js";
import { EditorialEngineError } from "../../editorial/engine/editorial-engine-error.js";
import type { EditorialEngineEvent } from "../../editorial/engine/editorial-engine-event.js";
import type { EditorialAssistantTool } from "../../editorial/engine/editorial-assistant-tool.js";
import { EDITORIAL_CAPABILITY, isValidatedEditorialCapabilityCall, type EditorialCapabilityCatalog, type EditorialCapabilityDefinition, type StreamContext } from "./editorial-capability-catalog.js";
import type { ActionCapability } from "./action-capability.js";
import type { CompletionEvent } from "../completion/completion-event.js";
import type { PreparedAssistantRequest } from "../requests/prepared-assistant-request.js";
import type { ReadCapability } from "./read-capability.js";
import type { AssistantStore } from "../assistant-store.js";
import type { EditorialEngineResolver } from "../../editorial/engine/editorial-engine-resolver.js";
import type { ConversationHistory } from "../requests/conversation-history.js";
import { AssistantSkillCatalog } from "../skills/assistant-skill-catalog.js";
import type { AuthorSkillService } from "../skills/author-skill-service.js";
import { AuthorSkillChatActions } from "../skills/author-skill-chat-actions.js";
import type { CommittedAuthorSkillChange } from "../skills/committed-author-skill-change.js";


function isTransientReadFailure(error: unknown): boolean {
    return error instanceof ApplicationServiceError && error.code === APPLICATION_ERROR.EDITORIAL_PROVIDER_FAILED;
}


export class AssistantCapabilityLoop {
    private readonly authorSkillActions?: AuthorSkillChatActions;


    constructor(private readonly dependencies: {
        assistant: Pick<AssistantStore, "setExecution">;
        engines: Pick<EditorialEngineResolver, "resolveAssistantActionIntentVerifier">;
        capabilities?: Pick<EditorialCapabilityCatalog, "getDefinitions" | "discover" | "read" | "executeAction" | "stream">;
        authorSkills?: AuthorSkillService;
        skills: AssistantSkillCatalog;
        conversationHistory: (articleId: string, limit?: number) => ConversationHistory;
    }) {
        if (dependencies.authorSkills)
            this.authorSkillActions = new AuthorSkillChatActions(dependencies.authorSkills, dependencies.engines);
    }


    async *stream(request: PreparedAssistantRequest, signal: AbortSignal): AsyncIterable<EditorialEngineEvent> {
        if (!request.engine.streamAssistant || !this.dependencies.capabilities)
            throw new EditorialEngineError(EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT, EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT);

        const excerpt = this.getArticleExcerpt(request);
        const summaries = this.dependencies.skills.discover();
        const skills = this.dependencies.skills.load(summaries.map((skill) => skill.reference));
        const selectedSkills = request.resolvedSkillId
            ? skills.filter((skill) => skill.reference.id === request.resolvedSkillId)
            : [];
        const authorContext = !isBuiltInSkillId(request.resolvedSkillId ?? "")
            ? [request.authorMessage, ...selectedSkills.flatMap((skill) => [skill.instructions, ...(skill.references ?? [])])].filter(Boolean).join("\n\n")
            : request.authorMessage;
        let primary: CompletionEvent | undefined;
        const tools = this.createCapabilityTools(request, excerpt, authorContext, () => primary, (event) => {
            primary = event;
        });

        const editorialRequest = {
            message: request.authorMessage,
            interfaceLocale: request.interfaceLocale,
            article: "",
            scope: request.scope.kind,
            instructions: selectedSkills.flatMap((skill) => [skill.instructions, ...(skill.references ?? [])]),
            history: this.dependencies.conversationHistory(request.articleId, 12),
            skills: skills.map((skill) => ({ id: skill.reference.id, name: skill.name, description: skill.description, instructions: [skill.instructions, ...(skill.references ?? [])].join("\n\n"), capabilities: this.initialCapabilities(skill.reference.id, request.scope.kind) })),
            tools,
            ...(request.resolvedSkillId ? { initialActiveCapabilities: this.initialCapabilities(request.resolvedSkillId, request.scope.kind) } : {}),
        };

        const stream = request.engine.streamAssistant(editorialRequest, signal);
        for await (const event of stream) {
            if (event.type !== EDITORIAL_ENGINE_EVENT.COMPLETED) {
                yield event;
                continue;
            }

            if (primary) {
                yield primary;
                continue;
            }

            if (request.operation || (request.resolvedSkillId && !isBuiltInSkillId(request.resolvedSkillId)))
                throw new EditorialEngineError(EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT, EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT);

            yield event;
        }
    }


    private getArticleExcerpt(request: PreparedAssistantRequest): string {
        return request.scope.kind === "selection"
            ? request.articleContent.slice(request.scope.startOffset, request.scope.endOffset)
            : request.articleContent;
    }


    private initialCapabilities(skill: string, scope: "article" | "selection"): readonly string[] {
        if (!isBuiltInSkillId(skill))
            return scope === "article"
                ? [EDITORIAL_CAPABILITY.INSPECT_ARTICLE, EDITORIAL_CAPABILITY.GENERATE_PROPOSAL]
                : [EDITORIAL_CAPABILITY.GENERATE_PROPOSAL];

        switch (skill) {
            case BUILT_IN_SKILL.FACT_CHECKING:
                return [EDITORIAL_CAPABILITY.FACT_CHECK, EDITORIAL_CAPABILITY.INSPECT_FACT_CHECKS];
            case BUILT_IN_SKILL.STYLE_REVIEW:
                return [EDITORIAL_CAPABILITY.STYLE_REVIEW, EDITORIAL_CAPABILITY.INSPECT_STYLE_CORPUS, EDITORIAL_CAPABILITY.INSPECT_ARTICLE_STYLE_RULES];
            case BUILT_IN_SKILL.TRANSLATION:
                return [EDITORIAL_CAPABILITY.TRANSLATE, EDITORIAL_CAPABILITY.INSPECT_TRANSLATIONS];
            case BUILT_IN_SKILL.SKILL_CREATOR:
                return ["create_author_skill", "get_author_skill", "list_author_skill_revisions", "read_author_skill_revision", "update_author_skill", "restore_author_skill", "delete_author_skill"];
            default:
                return [EDITORIAL_CAPABILITY.GENERATE_PROPOSAL];
        }
    }


    private createCapabilityTools(request: PreparedAssistantRequest, excerpt: string, authorContext: string, primary: () => CompletionEvent | undefined, setPrimary: (event: CompletionEvent) => void): EditorialAssistantTool[] {
        if (!this.dependencies.capabilities)
            return [];

        const definitions = request.scope.kind === "selection"
            ? this.dependencies.capabilities.getDefinitions().filter((definition) => definition.execution === "artifact" && definition.selectionCompatible)
            : this.dependencies.capabilities.getDefinitions();
        const tools: EditorialAssistantTool[] = definitions.map((definition) => ({
            capability: definition.id,
            description: definition.activity,
            input: definition.input,
            execute: (input, signal) => this.executeCapability(request, excerpt, authorContext, definition, input, signal, primary, setPrimary),
        }));

        tools.push({
            capability: "find_capabilities",
            description: "Find only classified Skladno Editorial capabilities, Workspace handoffs, or exclusions for the requested outcome.",
            input: "capability-query",
            execute: async (input) => this.dependencies.capabilities!.discover(input.query ?? "", request.scope.kind),
        });

        if (this.authorSkillActions)
            tools.push(...this.authorSkillActions.tools(request));

        return tools;
    }


    commitPendingSkill(request: PreparedAssistantRequest): CommittedAuthorSkillChange | undefined {
        return this.authorSkillActions?.commit(request);
    }


    rollbackCreatedSkill(change: CommittedAuthorSkillChange): void {
        this.authorSkillActions?.rollback(change);
    }


    private async executeCapability(request: PreparedAssistantRequest, excerpt: string, authorContext: string, definition: EditorialCapabilityDefinition, input: Readonly<Record<string, string>>, signal: AbortSignal, primary: () => CompletionEvent | undefined, setPrimary: (event: CompletionEvent) => void): Promise<unknown> {
        signal.throwIfAborted();
        if (!isValidatedEditorialCapabilityCall(definition.id, input))
            throw new EditorialEngineError(EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT, EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT);

        request.capabilityActivities.push({ summary: definition.activity, status: "started" });
        this.dependencies.assistant.setExecution(request.requestId, definition.id);

        if (definition.execution === "read")
            return this.executeReadCapability(request, definition, input);

        if (definition.execution === "action")
            return this.stageAction(request, definition, input, signal);

        return this.streamArtifactCapability(request, excerpt, authorContext, definition, input, signal, primary, setPrimary);
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

        signal.throwIfAborted();
        request.authorizedActions = [...request.authorizedActions, action];
        request.pendingActions.push({ capability: action, input });
        this.completeCapability(request, definition);

        return { status: "staged" };
    }


    private async streamArtifactCapability(request: PreparedAssistantRequest, excerpt: string, authorContext: string, definition: EditorialCapabilityDefinition, input: Readonly<Record<string, string>>, signal: AbortSignal, primary: () => CompletionEvent | undefined, setPrimary: (event: CompletionEvent) => void): Promise<{ status: "prepared" }> {
        const streamContext = {
            capability: definition.id as StreamContext["capability"],
            context: { articleId: request.articleId, baseRevisionId: request.scope.baseRevisionId },
            requestId: request.requestId,
            authorContext,
            ...(request.resolvedSkillId && isBuiltInSkillId(request.resolvedSkillId) ? { skillId: request.resolvedSkillId } : {}),
            ...(request.publishingCharacterLimit ? { targetArticleCharacterLimit: request.publishingCharacterLimit } : {}),
            ...(input.operation ? { operation: input.operation as StreamContext["operation"] } : {}),
            ...(input.targetLanguage ? { targetLanguage: input.targetLanguage } : {}),
            ...(input.findingIds ? { findingIds: input.findingIds } : {}),
            ...(request.scope.kind === "selection" ? { articleContent: excerpt, articleSelection: true, surroundingArticleCharacterCount: request.articleContent.length - excerpt.length } : {}),
        };

        const stream = this.dependencies.capabilities!.stream(streamContext, signal, true);
        for await (const event of stream) {
            signal.throwIfAborted();
            if (event.type !== EDITORIAL_ENGINE_EVENT.COMPLETED)
                continue;

            if (primary())
                throw new EditorialEngineError(EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT, EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT);

            request.completedCapability = definition.id;
            setPrimary(event);
        }

        signal.throwIfAborted();
        this.completeCapability(request, definition);
        return { status: "prepared" };
    }


    private completeCapability(request: PreparedAssistantRequest, definition: EditorialCapabilityDefinition): void {
        request.capabilityActivities.push({ summary: definition.activity, status: "completed" });
        this.dependencies.assistant.setExecution(request.requestId, definition.id, "completed");
    }
}
