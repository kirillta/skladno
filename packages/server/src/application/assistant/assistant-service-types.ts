import type { AssistantAuthorizedAction, BuiltInSkillId, EditorialOperation, FactCheck, FactCheckFinding, NewAssistantRequest, StartAssistantRequest } from "@skladno/shared";

import type { EditorialCapabilityId } from "./editorial-capability-catalog.js";
import type { EditorialEngine } from "../ports/editorial-engine.js";
import type { EditorialEngineEvent } from "../ports/editorial-engine-event.js";


export type AssistantServiceRequest = StartAssistantRequest & { articleId: string };


export type ReplayedAssistantRequest = NewAssistantRequest & { articleId: string; retryOfRequestId?: string };


export type ReadCapability = Extract<EditorialCapabilityId, "inspect_article" | "inspect_linked_articles" | "inspect_revisions" | "inspect_draft" | "inspect_artifacts" | "inspect_proposal_summary" | "inspect_fact_checks" | "inspect_publishing_guidance" | "inspect_style_corpus" | "inspect_article_style_rules" | "inspect_translations">;


export type ActionCapability = Extract<EditorialCapabilityId, "rename_article" | "change_article_language" | "assign_publishing_profile" | "set_article_style_rules" | "add_revision_to_style_corpus" | "rebuild_style_profile">;


export type CompletionEvent = Extract<EditorialEngineEvent, { type: "completed" }>;


export interface FactChecksStore {
    list(articleId: string): FactCheck[];
    save(artifactId: string, articleId: string, revisionId: string): void;
}


export interface PreparedAssistantRequest extends ReplayedAssistantRequest {
    articleId: string;
    articleContent: string;
    articleTitle: string;
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


export type ConversationHistory = { role: "author" | "assistant"; content: string }[];
