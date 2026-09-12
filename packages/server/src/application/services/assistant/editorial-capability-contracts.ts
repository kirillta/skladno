import type { AssistantAuthorizedAction, BuiltInSkillId, EditorialOperation } from "@skladno/shared";

export const EDITORIAL_CAPABILITY = {
    INSPECT_ARTICLE: "inspect_article", INSPECT_LINKED_ARTICLES: "inspect_linked_articles", INSPECT_REVISIONS: "inspect_revisions", INSPECT_DRAFT: "inspect_draft", INSPECT_ARTIFACTS: "inspect_artifacts", INSPECT_PROPOSAL_SUMMARY: "inspect_proposal_summary", INSPECT_FACT_CHECKS: "inspect_fact_checks", INSPECT_PUBLISHING_GUIDANCE: "inspect_publishing_guidance", INSPECT_STYLE_CORPUS: "inspect_style_corpus", INSPECT_ARTICLE_STYLE_RULES: "inspect_article_style_rules", INSPECT_TRANSLATIONS: "inspect_translations",
    RENAME_ARTICLE: "rename_article", CHANGE_ARTICLE_LANGUAGE: "change_article_language", ASSIGN_PUBLISHING_PROFILE: "assign_publishing_profile", SET_ARTICLE_STYLE_RULES: "set_article_style_rules", ADD_REVISION_TO_STYLE_CORPUS: "add_revision_to_style_corpus", REBUILD_STYLE_PROFILE: "rebuild_style_profile",
    GENERATE_PROPOSAL: "generate_proposal", GENERATE_FINDING_CORRECTIONS: "generate_finding_corrections", FACT_CHECK: "fact_check", STYLE_REVIEW: "style_review", TRANSLATE: "translate",
} as const;

export type EditorialCapabilityId = typeof EDITORIAL_CAPABILITY[keyof typeof EDITORIAL_CAPABILITY];
export const EDITORIAL_CAPABILITY_INPUT = {
    NONE: "none",
    PROPOSAL_OPERATION: "proposal-operation",
    TARGET_LANGUAGE: "target-language",
    TITLE: "title",
    LANGUAGE: "language",
    PUBLISHING_PROFILE: "publishing-profile",
    STYLE_RULES: "style-rules",
    ARTIFACT_ID: "artifact-id",
    FINDING_IDS: "finding-ids"
} as const;

export type EditorialCapabilityInput = typeof EDITORIAL_CAPABILITY_INPUT[keyof typeof EDITORIAL_CAPABILITY_INPUT];
export type EditorialCapabilityResultKind = "article" | "linked-articles" | "revisions" | "draft" | "artifacts" | "proposal-summary" | "fact-checks" | "publishing-guidance" | "style-corpus" | "style-rules" | "translations" | "proposal" | "fact-check" | "style-review" | "translation";
export type WorkspaceDestination = "write" | "proposal" | "revisions" | "fact-check" | "style-profile" | "translations" | "settings" | "article-library" | "article-status";
export type EditorialOperationClassificationKind = "callable-read" | "callable-action" | "callable-artifact" | "workspace-handoff" | "excluded";


export interface EditorialCapabilityDefinition { id: EditorialCapabilityId; allowedContext: "article"; selectionCompatible?: boolean; input: EditorialCapabilityInput; execution: "read" | "artifact" | "action"; prerequisite?: "style-corpus" | "target-language"; result: EditorialCapabilityResultKind; retry: "never" | "transient-read"; activity: string; }


export interface EditorialOperationClassification { id: string; kind: EditorialOperationClassificationKind; outcome: string; aliases: readonly string[]; capability?: EditorialCapabilityId; destination?: WorkspaceDestination; reason?: string; }


export interface EditorialCapabilityContext { articleId: string; baseRevisionId: string; authorizedActions?: readonly AssistantAuthorizedAction[]; }


export interface EditorialCapabilityDiscoveryResult { operationId: string; classification: EditorialOperationClassificationKind; outcome: string; requiredInput?: EditorialCapabilityInput; capability?: EditorialCapabilityId; destination?: WorkspaceDestination; reason?: string; }


export interface TransportEvaluation { transport: "http" | "stream" | "electron"; operation?: string; outsideAssistantAuthority?: string; }


export interface StreamContext { capability: Extract<EditorialCapabilityId, "generate_proposal" | "generate_finding_corrections" | "fact_check" | "style_review" | "translate">; context: EditorialCapabilityContext; requestId: string; authorContext: string; skillId?: BuiltInSkillId; targetArticleCharacterLimit?: number; operation?: Extract<EditorialOperation, "thesis_to_narrative" | "flow_revision">; targetLanguage?: string; findingIds?: string; articleContent?: string; articleSelection?: boolean; surroundingArticleCharacterCount?: number; }

