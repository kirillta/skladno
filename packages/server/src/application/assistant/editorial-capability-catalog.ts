import { APPLICATION_ERROR, EDITORIAL_OPERATION, HTTP_STATUS, getPublishLimitProfile, isArticleLanguage, isPublishLimitProfileId, type Article, type AssistantAuthorizedAction, type EditorialArtifact, type EditorialOperation, type FactCheck, type StyleCorpus } from "@skladno/shared";

import { ApplicationServiceError } from "../errors/application-service-error.js";
import type { ArticleService } from "../articles/article-service.js";
import type { EditorialService } from "../editorial/editorial-service.js";
import type { PublishingService } from "../publishing/publishing-service.js";
import type { EditorialEngineEvent } from "../ports/editorial-engine-event.js";
import type { StyleCorpusService } from "../editorial/style-corpus-service.js";


export const EDITORIAL_CAPABILITY = {
    INSPECT_ARTICLE: "inspect_article", INSPECT_LINKED_ARTICLES: "inspect_linked_articles", INSPECT_REVISIONS: "inspect_revisions", INSPECT_DRAFT: "inspect_draft", INSPECT_ARTIFACTS: "inspect_artifacts", INSPECT_PROPOSAL_SUMMARY: "inspect_proposal_summary", INSPECT_FACT_CHECKS: "inspect_fact_checks", INSPECT_PUBLISHING_GUIDANCE: "inspect_publishing_guidance", INSPECT_STYLE_CORPUS: "inspect_style_corpus", INSPECT_ARTICLE_STYLE_RULES: "inspect_article_style_rules", INSPECT_TRANSLATIONS: "inspect_translations",
    RENAME_ARTICLE: "rename_article", CHANGE_ARTICLE_LANGUAGE: "change_article_language", ASSIGN_PUBLISHING_PROFILE: "assign_publishing_profile", SET_ARTICLE_STYLE_RULES: "set_article_style_rules", ADD_REVISION_TO_STYLE_CORPUS: "add_revision_to_style_corpus", REBUILD_STYLE_PROFILE: "rebuild_style_profile",
    GENERATE_PROPOSAL: "generate_proposal", GENERATE_FINDING_CORRECTIONS: "generate_finding_corrections", FACT_CHECK: "fact_check", STYLE_REVIEW: "style_review", TRANSLATE: "translate",
} as const;

export type EditorialCapabilityId = typeof EDITORIAL_CAPABILITY[keyof typeof EDITORIAL_CAPABILITY];
export type EditorialCapabilityInput = "none" | "proposal-operation" | "target-language" | "title" | "language" | "publishing-profile" | "style-rules" | "artifact-id" | "finding-ids";
export type EditorialCapabilityResultKind = "article" | "linked-articles" | "revisions" | "draft" | "artifacts" | "proposal-summary" | "fact-checks" | "publishing-guidance" | "style-corpus" | "style-rules" | "translations" | "proposal" | "fact-check" | "style-review" | "translation";
export type WorkspaceDestination = "write" | "proposal" | "revisions" | "fact-check" | "style-profile" | "translations" | "settings" | "article-library" | "article-status";
export type EditorialOperationClassificationKind = "callable-read" | "callable-action" | "callable-artifact" | "workspace-handoff" | "excluded";


export interface EditorialCapabilityDefinition { id: EditorialCapabilityId; allowedContext: "article"; selectionCompatible?: boolean; input: EditorialCapabilityInput; execution: "read" | "artifact" | "action"; prerequisite?: "style-corpus" | "target-language"; result: EditorialCapabilityResultKind; retry: "never" | "transient-read"; activity: string; }


export interface EditorialOperationClassification { id: string; kind: EditorialOperationClassificationKind; outcome: string; aliases: readonly string[]; capability?: EditorialCapabilityId; destination?: WorkspaceDestination; reason?: string; }


const callable = (id: string, kind: Extract<EditorialOperationClassificationKind, "callable-read" | "callable-action" | "callable-artifact">, capability: EditorialCapabilityId, outcome: string, aliases: readonly string[]): EditorialOperationClassification => ({ id, kind, capability, outcome, aliases });
const handoff = (id: string, destination: WorkspaceDestination, outcome: string, reason: string, aliases: readonly string[]): EditorialOperationClassification => ({ id, kind: "workspace-handoff", destination, outcome, reason, aliases });
const excluded = (id: string, outcome: string, reason: string, aliases: readonly string[]): EditorialOperationClassification => ({ id, kind: "excluded", outcome, reason, aliases });

/** Author-facing Workspace inventory. It documents authority; it is not a transport API. */
export const editorialOperationClassifications: readonly EditorialOperationClassification[] = [
    callable("article.inspect", "callable-read", EDITORIAL_CAPABILITY.INSPECT_ARTICLE, "Inspect current Article metadata and saved Revision.", ["article", "metadata", "current revision"]),
    callable("article.linked.inspect", "callable-read", EDITORIAL_CAPABILITY.INSPECT_LINKED_ARTICLES, "Inspect source and linked translation Articles.", ["linked", "source", "translation article"]),
    callable("article.rename", "callable-action", EDITORIAL_CAPABILITY.RENAME_ARTICLE, "Rename the current Article without a Revision.", ["rename", "title"]),
    callable("article.language.change", "callable-action", EDITORIAL_CAPABILITY.CHANGE_ARTICLE_LANGUAGE, "Change current Article language metadata; this does not translate content.", ["language", "primary language", "metadata"]),
    callable("article.publishing-profile.assign", "callable-action", EDITORIAL_CAPABILITY.ASSIGN_PUBLISHING_PROFILE, "Assign an existing Publishing profile to the current Article.", ["publishing profile", "profile", "guidance"]),
    handoff("article.create", "article-library", "Create a blank Article.", "Article creation needs library choices and selection.", ["create article", "new article"]), handoff("article.delete", "article-library", "Delete the current Article.", "Deletion requires the library confirmation and recovery warning.", ["delete article", "remove article"]), excluded("library.search", "Search the Article library.", "Assistant authority is limited to the current Article.", ["library", "search articles", "all articles"]),
    callable("revisions.inspect", "callable-read", EDITORIAL_CAPABILITY.INSPECT_REVISIONS, "Inspect Revision history.", ["history", "revision", "versions"]), callable("draft.inspect", "callable-read", EDITORIAL_CAPABILITY.INSPECT_DRAFT, "Inspect Draft freshness metadata without Draft text.", ["draft", "checkpoint", "unsaved"]), handoff("draft.mutate", "write", "Edit, discard, or promote a Draft.", "Draft text and conflict recovery remain in the editor.", ["discard draft", "save draft", "promote draft"]), handoff("revision.restore", "revisions", "Restore a Revision.", "Restoring creates a new Revision and requires confirmation.", ["restore revision", "revert"]),
    callable("artifacts.inspect", "callable-read", EDITORIAL_CAPABILITY.INSPECT_ARTIFACTS, "Inspect saved editorial artifact summaries.", ["artifact", "proposal", "editorial work"]), callable("proposal.summary", "callable-read", EDITORIAL_CAPABILITY.INSPECT_PROPOSAL_SUMMARY, "Inspect a saved Proposal summary.", ["summarize proposal", "proposal changes"]), callable("proposal.generate", "callable-artifact", EDITORIAL_CAPABILITY.GENERATE_PROPOSAL, "Prepare a Talking Points, Narrative Draft, or Flow and Clarity Proposal.", ["talking points", "narrative", "flow", "clarity"]), handoff("proposal.decide", "proposal", "Accept, reject, dismiss, or partially accept a Proposal.", "Proposal decisions require visual diff review and explicit approval.", ["accept proposal", "reject proposal", "dismiss proposal"]),
    callable("fact-check.run", "callable-artifact", EDITORIAL_CAPABILITY.FACT_CHECK, "Run an advisory Fact Check.", ["fact check", "verify", "citations"]), callable("fact-check.inspect", "callable-read", EDITORIAL_CAPABILITY.INSPECT_FACT_CHECKS, "Inspect current Fact Check findings and freshness.", ["findings", "claims", "fact status"]), callable("fact-check.corrections", "callable-artifact", EDITORIAL_CAPABILITY.GENERATE_FINDING_CORRECTIONS, "Prepare a correction Proposal for explicitly selected Findings.", ["correct findings", "propose corrections"]), handoff("fact-check.resolve", "fact-check", "Resolve a Finding.", "Finding resolution is an Author judgment in Fact Check.", ["resolve finding", "accept evidence"]),
    callable("style-corpus.inspect", "callable-read", EDITORIAL_CAPABILITY.INSPECT_STYLE_CORPUS, "Inspect Style Corpus readiness and compact rules.", ["style corpus", "style profile"]), callable("style-rules.inspect", "callable-read", EDITORIAL_CAPABILITY.INSPECT_ARTICLE_STYLE_RULES, "Inspect current Article-specific style rules.", ["article style rules", "style rules"]), callable("style-rules.set", "callable-action", EDITORIAL_CAPABILITY.SET_ARTICLE_STYLE_RULES, "Replace current Article-specific style rules.", ["set style rules", "replace style rules"]), callable("style-corpus.add-revision", "callable-action", EDITORIAL_CAPABILITY.ADD_REVISION_TO_STYLE_CORPUS, "Add the current immutable Revision to the Style Corpus.", ["add revision to style corpus"]), callable("style-profile.rebuild", "callable-action", EDITORIAL_CAPABILITY.REBUILD_STYLE_PROFILE, "Rebuild the local Style Profile.", ["rebuild style profile"]), callable("style-review.run", "callable-artifact", EDITORIAL_CAPABILITY.STYLE_REVIEW, "Run a Style Review.", ["style review", "voice", "tone"]), handoff("style-corpus.manage", "style-profile", "Manage Style Corpus samples or global rules.", "Corpus management needs the Style Profile View.", ["remove style sample", "global rules", "include sample"]),
    callable("translations.inspect", "callable-read", EDITORIAL_CAPABILITY.INSPECT_TRANSLATIONS, "Inspect prepared translations and Article linkage.", ["prepared translations", "translation status"]), callable("translation.prepare", "callable-artifact", EDITORIAL_CAPABILITY.TRANSLATE, "Prepare a translation Proposal without changing Article language metadata.", ["translate", "translation"]), handoff("translation.create-linked", "translations", "Create or update a linked translation Article.", "Translation Article creation stays explicitly recoverable in Translations.", ["create translation article", "save translation"]), callable("publishing.inspect", "callable-read", EDITORIAL_CAPABILITY.INSPECT_PUBLISHING_GUIDANCE, "Inspect assigned Publishing guidance.", ["publishing guidance", "character limit"]), handoff("publishing.copy", "article-status", "Copy Markdown or plain text for publication.", "Copy remains an explicit local clipboard action.", ["copy markdown", "copy plain text"]), excluded("publishing.profiles.manage", "Create, edit, or delete Publishing profile definitions.", "Publishing profile definitions belong to Settings.", ["edit publishing profile", "new publishing profile"]), excluded("publishing.external", "Publish externally.", "Skladno never publishes directly.", ["publish", "post externally"]), handoff("workspace.open-view", "write", "Open a Workspace View.", "Workspace navigation remains a renderer-owned action.", ["open view", "go to"]), excluded("application.administration", "Change Settings, credentials, backups, diagnostics, or updates.", "These cross application and privileged boundaries.", ["settings", "credentials", "backup", "diagnostics", "updates"]),
];

export const editorialCapabilityDefinitions: readonly EditorialCapabilityDefinition[] = [
    { id: EDITORIAL_CAPABILITY.INSPECT_ARTICLE, execution: "read", allowedContext: "article", input: "none", result: "article", retry: "transient-read", activity: "Reviewing the current Article." }, { id: EDITORIAL_CAPABILITY.INSPECT_LINKED_ARTICLES, execution: "read", allowedContext: "article", input: "none", result: "linked-articles", retry: "transient-read", activity: "Reviewing linked Articles." }, { id: EDITORIAL_CAPABILITY.INSPECT_REVISIONS, execution: "read", allowedContext: "article", input: "none", result: "revisions", retry: "transient-read", activity: "Reviewing Revision history." }, { id: EDITORIAL_CAPABILITY.INSPECT_DRAFT, execution: "read", allowedContext: "article", input: "none", result: "draft", retry: "transient-read", activity: "Reviewing Draft state." }, { id: EDITORIAL_CAPABILITY.INSPECT_ARTIFACTS, execution: "read", allowedContext: "article", input: "none", result: "artifacts", retry: "transient-read", activity: "Reviewing saved editorial work." }, { id: EDITORIAL_CAPABILITY.INSPECT_PROPOSAL_SUMMARY, execution: "read", allowedContext: "article", input: "artifact-id", result: "proposal-summary", retry: "transient-read", activity: "Reviewing Proposal changes." }, { id: EDITORIAL_CAPABILITY.INSPECT_FACT_CHECKS, execution: "read", allowedContext: "article", input: "none", result: "fact-checks", retry: "transient-read", activity: "Reviewing Fact Check findings." }, { id: EDITORIAL_CAPABILITY.INSPECT_PUBLISHING_GUIDANCE, execution: "read", allowedContext: "article", input: "none", result: "publishing-guidance", retry: "transient-read", activity: "Reviewing publishing guidance." }, { id: EDITORIAL_CAPABILITY.INSPECT_STYLE_CORPUS, execution: "read", allowedContext: "article", input: "none", result: "style-corpus", retry: "transient-read", activity: "Reviewing the Style Corpus." }, { id: EDITORIAL_CAPABILITY.INSPECT_ARTICLE_STYLE_RULES, execution: "read", allowedContext: "article", input: "none", result: "style-rules", retry: "transient-read", activity: "Reviewing Article style rules." }, { id: EDITORIAL_CAPABILITY.INSPECT_TRANSLATIONS, execution: "read", allowedContext: "article", input: "none", result: "translations", retry: "transient-read", activity: "Reviewing translations." },
    { id: EDITORIAL_CAPABILITY.RENAME_ARTICLE, execution: "action", allowedContext: "article", input: "title", result: "article", retry: "never", activity: "Renaming the current Article." }, { id: EDITORIAL_CAPABILITY.CHANGE_ARTICLE_LANGUAGE, execution: "action", allowedContext: "article", input: "language", result: "article", retry: "never", activity: "Changing the Article language." }, { id: EDITORIAL_CAPABILITY.ASSIGN_PUBLISHING_PROFILE, execution: "action", allowedContext: "article", input: "publishing-profile", result: "article", retry: "never", activity: "Assigning publishing guidance." }, { id: EDITORIAL_CAPABILITY.SET_ARTICLE_STYLE_RULES, execution: "action", allowedContext: "article", input: "style-rules", result: "style-rules", retry: "never", activity: "Updating Article style rules." }, { id: EDITORIAL_CAPABILITY.ADD_REVISION_TO_STYLE_CORPUS, execution: "action", allowedContext: "article", input: "none", result: "style-corpus", retry: "never", activity: "Adding the current Revision to the Style Corpus." }, { id: EDITORIAL_CAPABILITY.REBUILD_STYLE_PROFILE, execution: "action", allowedContext: "article", input: "none", prerequisite: "style-corpus", result: "style-corpus", retry: "never", activity: "Rebuilding the Style Profile." },
    { id: EDITORIAL_CAPABILITY.GENERATE_PROPOSAL, execution: "artifact", allowedContext: "article", selectionCompatible: true, input: "proposal-operation", result: "proposal", retry: "never", activity: "Preparing a Proposal." }, { id: EDITORIAL_CAPABILITY.GENERATE_FINDING_CORRECTIONS, execution: "artifact", allowedContext: "article", input: "finding-ids", result: "proposal", retry: "never", activity: "Preparing Finding corrections." }, { id: EDITORIAL_CAPABILITY.FACT_CHECK, execution: "artifact", allowedContext: "article", selectionCompatible: true, input: "none", result: "fact-check", retry: "never", activity: "Checking facts." }, { id: EDITORIAL_CAPABILITY.STYLE_REVIEW, execution: "artifact", allowedContext: "article", selectionCompatible: true, input: "none", prerequisite: "style-corpus", result: "style-review", retry: "never", activity: "Reviewing style." }, { id: EDITORIAL_CAPABILITY.TRANSLATE, execution: "artifact", allowedContext: "article", input: "target-language", prerequisite: "target-language", result: "translation", retry: "never", activity: "Preparing a translation." },
];


export interface EditorialCapabilityContext { articleId: string; baseRevisionId: string; authorizedActions?: readonly AssistantAuthorizedAction[]; }


export interface EditorialCapabilityDiscoveryResult { operationId: string; classification: EditorialOperationClassificationKind; outcome: string; requiredInput?: EditorialCapabilityInput; capability?: EditorialCapabilityId; destination?: WorkspaceDestination; reason?: string; }


export interface TransportEvaluation { transport: "http" | "stream" | "electron"; operation?: string; outsideAssistantAuthority?: string; }


export const transportEvaluations: readonly TransportEvaluation[] = [
    { transport: "stream", operation: "proposal.generate" },
    { transport: "stream", operation: "fact-check.run" },
    { transport: "stream", operation: "translation.prepare" },
    { transport: "http", operation: "article.rename" },
    { transport: "http", operation: "article.language.change" },
    { transport: "http", operation: "article.publishing-profile.assign" },
    { transport: "http", operation: "revision.restore" },
    { transport: "electron", operation: "article.rename" },
    { transport: "electron", operation: "article.language.change" },
    { transport: "electron", operation: "article.publishing-profile.assign" },
    { transport: "electron", outsideAssistantAuthority: "desktop lifecycle and transport dispatch" }
];


function hasExactKeys(input: Readonly<Record<string, string>>, key?: string): boolean {
    const keys = Object.keys(input);
    return key ? keys.length === 1 && keys[0] === key && Boolean(input[key]?.trim()) : keys.length === 0;
}


export function isValidatedEditorialCapabilityCall(capability: string, input: Readonly<Record<string, string>>): capability is EditorialCapabilityId {
    const definition = editorialCapabilityDefinitions.find((candidate) => candidate.id === capability);
    if (!definition)
        return false;

    switch (definition.input) {
        case "none":
            return hasExactKeys(input);
        case "proposal-operation":
            return hasExactKeys(input, "operation") && (input.operation === EDITORIAL_OPERATION.THESIS_TO_NARRATIVE || input.operation === EDITORIAL_OPERATION.FLOW_REVISION);
        case "target-language":
            return hasExactKeys(input, "targetLanguage");
        case "title":
            return hasExactKeys(input, "title");
        case "language":
            return hasExactKeys(input, "language") && isArticleLanguage(input.language);
        case "publishing-profile":
            return hasExactKeys(input, "profileId") && isPublishLimitProfileId(input.profileId);
        case "style-rules":
            return Object.keys(input).length === 1 && Object.keys(input)[0] === "rules";
        case "artifact-id":
            return hasExactKeys(input, "artifactId");
        case "finding-ids":
            return hasExactKeys(input, "findingIds") && input.findingIds.split(",").every((id) => Boolean(id.trim()));
    }
}


export function validateEditorialCapabilityCoverage(): void {
    const operations = new Set<string>();
    const capabilities = new Set<EditorialCapabilityId>();
    for (const entry of editorialOperationClassifications) {
        if (operations.has(entry.id))
            throw new Error(`Duplicate Editorial operation classification: ${entry.id}`);

        operations.add(entry.id);
        if (entry.capability) {
            if (capabilities.has(entry.capability))
                throw new Error(`Capability has more than one Editorial operation: ${entry.capability}`);

            capabilities.add(entry.capability);
        }
    }

    for (const definition of editorialCapabilityDefinitions)
        if (!capabilities.has(definition.id))
            throw new Error(`Capability has no Editorial operation classification: ${definition.id}`);

    for (const evaluation of transportEvaluations) {
        if (!evaluation.operation && !evaluation.outsideAssistantAuthority)
            throw new Error("Transport evaluation needs an operation or outside-authority reason.");

        if (evaluation.operation && !operations.has(evaluation.operation))
            throw new Error(`Transport maps to an unknown Editorial operation: ${evaluation.operation}`);
    }
}


export function capabilityForEditorialOperation(operation: EditorialOperation): Extract<EditorialCapabilityId, "generate_proposal" | "fact_check" | "style_review" | "translate"> {
    if (operation === EDITORIAL_OPERATION.FACT_CHECK)
        return EDITORIAL_CAPABILITY.FACT_CHECK;

    if (operation === EDITORIAL_OPERATION.STYLE_REVIEW)
        return EDITORIAL_CAPABILITY.STYLE_REVIEW;

    if (operation === EDITORIAL_OPERATION.TRANSLATION)
        return EDITORIAL_CAPABILITY.TRANSLATE;

    return EDITORIAL_CAPABILITY.GENERATE_PROPOSAL;
}


export function activityForEditorialOperation(operation: EditorialOperation): string {
    return editorialCapabilityDefinitions.find((definition) => definition.id === capabilityForEditorialOperation(operation))?.activity ?? "Preparing editorial work.";
}


interface ArtifactStore { list(articleId: string): EditorialArtifact[]; get(artifactId: string, articleId: string): EditorialArtifact | undefined; }


interface FactChecksStore { list(articleId: string): FactCheck[]; }


export interface StreamContext { capability: Extract<EditorialCapabilityId, "generate_proposal" | "generate_finding_corrections" | "fact_check" | "style_review" | "translate">; context: EditorialCapabilityContext; requestId: string; authorContext: string; operation?: Extract<EditorialOperation, "thesis_to_narrative" | "flow_revision">; targetLanguage?: string; findingIds?: string; articleContent?: string; articleSelection?: boolean; surroundingArticleCharacterCount?: number; }


function currentArticle(articles: ArticleService, context: EditorialCapabilityContext): Article {
    const article = articles.getArticle(context.articleId);
    if (!article)
        throw new ApplicationServiceError(APPLICATION_ERROR.ARTICLE_NOT_FOUND, HTTP_STATUS.NOT_FOUND);

    if (article.currentRevisionId !== context.baseRevisionId)
        throw new ApplicationServiceError(APPLICATION_ERROR.REVISION_CONFLICT, HTTP_STATUS.CONFLICT);

    return article;
}


function operationFor(input: StreamContext): EditorialOperation {
    switch (input.capability) {
        case EDITORIAL_CAPABILITY.GENERATE_PROPOSAL:
            if (input.operation === EDITORIAL_OPERATION.THESIS_TO_NARRATIVE || input.operation === EDITORIAL_OPERATION.FLOW_REVISION)
                return input.operation;

            throw new ApplicationServiceError(APPLICATION_ERROR.INVALID_REQUEST, HTTP_STATUS.BAD_REQUEST);
        case EDITORIAL_CAPABILITY.GENERATE_FINDING_CORRECTIONS:
            return EDITORIAL_OPERATION.FLOW_REVISION;
        case EDITORIAL_CAPABILITY.FACT_CHECK:
            return EDITORIAL_OPERATION.FACT_CHECK;
        case EDITORIAL_CAPABILITY.STYLE_REVIEW:
            return EDITORIAL_OPERATION.STYLE_REVIEW;
        case EDITORIAL_CAPABILITY.TRANSLATE:
            if (!input.targetLanguage?.trim())
                throw new ApplicationServiceError(APPLICATION_ERROR.TARGET_LANGUAGE_REQUIRED, HTTP_STATUS.BAD_REQUEST);

            return EDITORIAL_OPERATION.TRANSLATION;
    }
}


function words(value: string): readonly string[] {
    return value.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((word) => word.length > 1);
}


function rank(query: string, entry: EditorialOperationClassification): number {
    const queryWords = new Set(words(query));
    return words([entry.id, entry.outcome, ...entry.aliases, entry.reason ?? ""].join(" ")).reduce((score, word) => score + (queryWords.has(word) ? 1 : 0), 0);
}


export class EditorialCapabilityCatalog {
    constructor(private readonly articles: ArticleService, private readonly artifacts: ArtifactStore, private readonly publishing: PublishingService, private readonly editorial: EditorialService, private readonly styleCorpus: StyleCorpusService, private readonly factChecks: FactChecksStore = { list: () => [] }) { }


    definitions(): readonly EditorialCapabilityDefinition[] {
        return editorialCapabilityDefinitions;
    }


    discover(query: string, scope: "article" | "selection"): readonly EditorialCapabilityDiscoveryResult[] {
        return editorialOperationClassifications.filter((entry) => {
            if (!entry.capability)
                return true;

            const definition = editorialCapabilityDefinitions.find((candidate) => candidate.id === entry.capability);
            return scope === "article" || definition?.selectionCompatible === true;
        }).map((entry) => ({ entry, score: rank(query, entry) })).filter(({ score }) => score > 0).sort((left, right) => right.score - left.score || left.entry.id.localeCompare(right.entry.id)).slice(0, 10).map(({ entry }) => {
            const definition = entry.capability ? editorialCapabilityDefinitions.find((candidate) => candidate.id === entry.capability) : undefined;
            return { operationId: entry.id, classification: entry.kind, outcome: entry.outcome, ...(definition && definition.input !== "none" ? { requiredInput: definition.input } : {}), ...(entry.capability ? { capability: entry.capability } : {}), ...(entry.destination ? { destination: entry.destination } : {}), ...(entry.reason ? { reason: entry.reason } : {}) };
        });
    }


    read(input: { capability: Extract<EditorialCapabilityId, "inspect_article" | "inspect_linked_articles" | "inspect_revisions" | "inspect_draft" | "inspect_artifacts" | "inspect_proposal_summary" | "inspect_fact_checks" | "inspect_publishing_guidance" | "inspect_style_corpus" | "inspect_article_style_rules" | "inspect_translations">; context: EditorialCapabilityContext; input?: Readonly<Record<string, string>> }): unknown;


    read(capability: Extract<EditorialCapabilityId, "inspect_article" | "inspect_linked_articles" | "inspect_revisions" | "inspect_draft" | "inspect_artifacts" | "inspect_proposal_summary" | "inspect_fact_checks" | "inspect_publishing_guidance" | "inspect_style_corpus" | "inspect_article_style_rules" | "inspect_translations">, context: EditorialCapabilityContext, input?: Readonly<Record<string, string>>): unknown;


    read(capabilityOrInput: Extract<EditorialCapabilityId, "inspect_article" | "inspect_linked_articles" | "inspect_revisions" | "inspect_draft" | "inspect_artifacts" | "inspect_proposal_summary" | "inspect_fact_checks" | "inspect_publishing_guidance" | "inspect_style_corpus" | "inspect_article_style_rules" | "inspect_translations"> | { capability: Extract<EditorialCapabilityId, "inspect_article" | "inspect_linked_articles" | "inspect_revisions" | "inspect_draft" | "inspect_artifacts" | "inspect_proposal_summary" | "inspect_fact_checks" | "inspect_publishing_guidance" | "inspect_style_corpus" | "inspect_article_style_rules" | "inspect_translations">; context: EditorialCapabilityContext; input?: Readonly<Record<string, string>> }, suppliedContext?: EditorialCapabilityContext, suppliedInput: Readonly<Record<string, string>> = {}): unknown {
        const capability = typeof capabilityOrInput === "string" ? capabilityOrInput : capabilityOrInput.capability;
        const context = typeof capabilityOrInput === "string" ? suppliedContext : capabilityOrInput.context;
        const input = typeof capabilityOrInput === "string" ? suppliedInput : capabilityOrInput.input ?? {};
        if (!context)
            throw new ApplicationServiceError(APPLICATION_ERROR.INVALID_REQUEST, HTTP_STATUS.BAD_REQUEST);

        if (!isValidatedEditorialCapabilityCall(capability, input))
            throw new ApplicationServiceError(APPLICATION_ERROR.INVALID_REQUEST, HTTP_STATUS.BAD_REQUEST);

        const article = currentArticle(this.articles, context);
        switch (capability) {
            case EDITORIAL_CAPABILITY.INSPECT_ARTICLE:
                return { id: article.id, title: article.title, language: article.language, audience: article.audience, publishingProfileId: article.publishingProfileId, currentRevision: { id: article.currentRevision.id, createdAt: article.currentRevision.createdAt, content: article.currentRevision.content } };
            case EDITORIAL_CAPABILITY.INSPECT_LINKED_ARTICLES:
                return this.articles.listArticles().filter((candidate) => candidate.id === article.sourceArticleId || candidate.sourceArticleId === article.id).map((candidate) => ({ id: candidate.id, title: candidate.title, language: candidate.language, sourceArticleId: candidate.sourceArticleId, sourceRevisionId: candidate.sourceRevisionId, currentRevisionId: candidate.currentRevisionId, updatedAt: candidate.updatedAt }));
            case EDITORIAL_CAPABILITY.INSPECT_REVISIONS:
                return this.articles.listRevisions(article.id).map((revision) => ({ id: revision.id, createdAt: revision.createdAt, provenance: revision.provenance, restoredFromRevisionId: revision.restoredFromRevisionId }));
            case EDITORIAL_CAPABILITY.INSPECT_DRAFT:
                return article.draft ? { state: article.draft.baseRevisionId === article.currentRevisionId ? "current" : "stale", baseRevisionId: article.draft.baseRevisionId, version: article.draft.version, updatedAt: article.draft.updatedAt } : { state: "none" };
            case EDITORIAL_CAPABILITY.INSPECT_ARTIFACTS:
                return this.artifacts.list(article.id).map(({ id, revisionId, kind, createdAt }) => ({ id, revisionId, kind, createdAt }));
            case EDITORIAL_CAPABILITY.INSPECT_PROPOSAL_SUMMARY: {
                const artifact = this.artifacts.get(input.artifactId!, article.id);
                if (!artifact)
                    throw new ApplicationServiceError(APPLICATION_ERROR.INVALID_REQUEST, HTTP_STATUS.BAD_REQUEST);

                const content: unknown = JSON.parse(artifact.content);
                return content && typeof content === "object" && !Array.isArray(content) ? { artifactId: artifact.id, summaries: (content as { proposalSummaries?: unknown }).proposalSummaries ?? [] } : { artifactId: artifact.id, summaries: [] };
            }
            case EDITORIAL_CAPABILITY.INSPECT_FACT_CHECKS:
                return this.factChecks.list(article.id).map((check) => ({ reviewedRevisionId: check.reviewedRevisionId, createdAt: check.createdAt, findings: check.findings.map(({ claim, status, sources, uncertainty, checkedAt, occurrenceId, resolution, stale }) => ({ claim, status, sources, uncertainty, checkedAt, occurrenceId, resolution, stale })) }));
            case EDITORIAL_CAPABILITY.INSPECT_PUBLISHING_GUIDANCE: {
                const settings = this.publishing.getSettings();
                const profileId = isPublishLimitProfileId(article.publishingProfileId) ? article.publishingProfileId : settings.defaultProfileId;
                return { profile: getPublishLimitProfile(profileId, settings) };
            }
            case EDITORIAL_CAPABILITY.INSPECT_STYLE_CORPUS: {
                const corpus = this.styleCorpus.get();
                return { status: corpus.status, itemCount: corpus.items.length, rules: corpus.rules, currentRevisionIncluded: corpus.items.some((item) => item.revisionId === article.currentRevisionId) };
            }
            case EDITORIAL_CAPABILITY.INSPECT_ARTICLE_STYLE_RULES:
                return { rules: this.styleCorpus.getArticleRules(article.id) };
            case EDITORIAL_CAPABILITY.INSPECT_TRANSLATIONS: {
                const prepared = this.artifacts.list(article.id).flatMap((artifact) => {
                    try {
                        const content = JSON.parse(artifact.content) as { translation?: { targetLanguage?: unknown } };
                        return typeof content.translation?.targetLanguage === "string" ? [{ artifactId: artifact.id, revisionId: artifact.revisionId, targetLanguage: content.translation.targetLanguage, fresh: artifact.revisionId === article.currentRevisionId }] : [];
                    } catch {
                        return [];
                    }
                });

                return { prepared, linked: this.articles.listArticles().filter((candidate) => candidate.sourceArticleId === article.id).map((candidate) => ({ id: candidate.id, title: candidate.title, language: candidate.language, sourceRevisionId: candidate.sourceRevisionId, fresh: candidate.sourceRevisionId === article.currentRevisionId })) };
            }
        }
    }


    action(capability: Extract<EditorialCapabilityId, "add_revision_to_style_corpus" | "rebuild_style_profile">, context: EditorialCapabilityContext): StyleCorpus;


    action(capability: Extract<EditorialCapabilityId, "rename_article" | "change_article_language" | "assign_publishing_profile" | "set_article_style_rules" | "add_revision_to_style_corpus" | "rebuild_style_profile">, context: EditorialCapabilityContext, input: Readonly<Record<string, string>>): Article | { rules: string } | StyleCorpus;


    action(capability: Extract<EditorialCapabilityId, "rename_article" | "change_article_language" | "assign_publishing_profile" | "set_article_style_rules" | "add_revision_to_style_corpus" | "rebuild_style_profile">, context: EditorialCapabilityContext, input: Readonly<Record<string, string>> = {}): Article | { rules: string } | StyleCorpus {
        if (!context.authorizedActions?.includes(capability) || !isValidatedEditorialCapabilityCall(capability, input))
            throw new ApplicationServiceError(APPLICATION_ERROR.INVALID_REQUEST, HTTP_STATUS.BAD_REQUEST);

        const article = currentArticle(this.articles, context);
        switch (capability) {
            case EDITORIAL_CAPABILITY.RENAME_ARTICLE:
                return this.articles.updateArticle(article.id, { title: input.title!.trim() });
            case EDITORIAL_CAPABILITY.CHANGE_ARTICLE_LANGUAGE:
                return this.articles.updateArticle(article.id, { language: input.language! });
            case EDITORIAL_CAPABILITY.ASSIGN_PUBLISHING_PROFILE: {
                const settings = this.publishing.getSettings();
                if (input.profileId!.startsWith("custom-") && !settings.customProfiles.some((profile) => profile.id === input.profileId))
                    throw new ApplicationServiceError(APPLICATION_ERROR.UNSUPPORTED_PUBLISHING_PROFILE, HTTP_STATUS.BAD_REQUEST);

                return this.articles.updateArticle(article.id, { publishingProfileId: input.profileId! });
            }
            case EDITORIAL_CAPABILITY.SET_ARTICLE_STYLE_RULES:
                return { rules: this.styleCorpus.setArticleRules(article.id, input.rules ?? "") };
            case EDITORIAL_CAPABILITY.ADD_REVISION_TO_STYLE_CORPUS:
                return this.styleCorpus.addArticleRevision(article.id, article.currentRevisionId);
            case EDITORIAL_CAPABILITY.REBUILD_STYLE_PROFILE:
                return this.styleCorpus.rebuild();
        }
    }


    stream(input: StreamContext, signal: AbortSignal, staged = false): AsyncIterable<EditorialEngineEvent> {
        let toolInput: Readonly<Record<string, string>> = {};
        if (input.capability === EDITORIAL_CAPABILITY.GENERATE_PROPOSAL)
            toolInput = { operation: input.operation ?? "" };
        else if (input.capability === EDITORIAL_CAPABILITY.GENERATE_FINDING_CORRECTIONS)
            toolInput = { findingIds: input.findingIds ?? "" };
        else if (input.capability === EDITORIAL_CAPABILITY.TRANSLATE)
            toolInput = { targetLanguage: input.targetLanguage ?? "" };

        if (!isValidatedEditorialCapabilityCall(input.capability, toolInput))
            throw new ApplicationServiceError(APPLICATION_ERROR.INVALID_REQUEST, HTTP_STATUS.BAD_REQUEST);

        currentArticle(this.articles, input.context);
        const operation = operationFor(input);
        const corrections = input.capability === EDITORIAL_CAPABILITY.GENERATE_FINDING_CORRECTIONS ? this.correctionContext(input.context.articleId, input.findingIds!) : "";
        const request = { articleId: input.context.articleId, requestId: input.requestId, operation, authorContext: corrections || input.authorContext, ...(input.targetLanguage?.trim() ? { targetLanguage: input.targetLanguage.trim() } : {}), ...(input.articleContent !== undefined ? { articleContent: input.articleContent } : {}), ...(input.articleSelection ? { articleSelection: true } : {}), ...(input.surroundingArticleCharacterCount !== undefined ? { surroundingArticleCharacterCount: input.surroundingArticleCharacterCount } : {}) };
        return staged ? this.editorial.streamStaged(request, signal) : this.editorial.stream(request, signal);
    }


    private correctionContext(articleId: string, findingIds: string): string {
        const selected = new Set(findingIds.split(",").map((id) => id.trim()));
        const findings = this.factChecks.list(articleId).flatMap((check) => check.findings).filter((finding) => finding.occurrenceId && selected.has(finding.occurrenceId));
        if (findings.length !== selected.size)
            throw new ApplicationServiceError(APPLICATION_ERROR.INVALID_REQUEST, HTTP_STATUS.BAD_REQUEST);

        return `Prepare a correction Proposal only for these explicitly selected advisory Findings. Preserve unrelated claims, numbers, URLs, code, technical terms, and author voice. Findings:\n${findings.map((finding) => `- ${finding.claim}: ${finding.rationale} Sources: ${finding.sources.map((source) => source.url).join(", ")}`).join("\n")}`;
    }
}
