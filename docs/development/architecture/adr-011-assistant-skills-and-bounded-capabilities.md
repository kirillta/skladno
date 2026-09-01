# ADR-011: Assistant uses skills through bounded application capabilities

- Status: Accepted
- Date: 2026-08-30
- Scope: Assistant skills, application capabilities, tool execution, Workspace handoffs, and generated artifact completion
- Depends on: [ADR-002](adr-002-shared-contract-organization.md), [ADR-003](adr-003-web-feature-oriented-react-architecture.md), [ADR-005](adr-005-article-state-and-consistency.md), [ADR-007](adr-007-completion-gated-editorial-engine.md), [ADR-008](adr-008-loopback-service-trust-boundary.md)

## Context

The Assistant supports free conversation and six built-in skills. A request either names one skill or passes through regex inference, then `AssistantService` maps that skill to one hard-coded Editorial operation. This makes common actions discoverable, but it limits an Author request to one baked-in workflow and keeps Skladno's other editorial features outside the conversation.

The dedicated Workspace Views remain central to Skladno. Proposal Review, Revision History, Fact Check, Style Profile, and Translations provide deliberate review and management that a chat transcript should not reproduce. Smoother Assistant interaction must preserve those views, explicit Author approval, minimum-context handling, Revision consistency, and completion-gated persistence.

## Decision

### One capability, two entry points

Define a server-owned catalog of approved Editorial capabilities. A capability is a narrow validated application operation with declared input, permitted Article context, prerequisites, result type, and execution policy. Assistant tools adapt model calls to these capabilities. Workspace Views call the same capabilities directly when they need deterministic behavior.

The first catalog covers safe existing work:

- inspect current Article metadata and saved Revision context;
- inspect relevant Revisions and editorial artifacts;
- inspect the selected Publishing profile guidance;
- run existing Proposal generation, fact-checking, style review, and translation operations.
- inspect Style Corpus readiness, add the current immutable Revision as a local style sample, and explicitly rebuild the Style Profile.

The catalog excludes Draft mutation, Proposal acceptance or rejection, Revision restoration, Finding resolution, translation Article creation, arbitrary Style Corpus editing or deletion, Publishing profile mutation, copying for publication, direct publishing, arbitrary filesystem or network access, credentials, persistence stores, and unrestricted internal routes. Adding the current immutable Revision and rebuilding its local Style Profile are allowed only after an explicit Author request. The excluded operations remain Author actions behind their existing application and Workspace boundaries.

Selection is an authority boundary. A selection-scoped request receives the selected text and required metadata. A capability that needs the whole Article must explain the need and obtain a new whole-Article request. If the current Revision changes during execution, the run stops instead of rebasing its work.

### Skills guide capability use

A Skill is a declarative instruction package that helps Assistant select and sequence capabilities. Built-in Skills use a small `SKILL.md`-style format with a stable ID, name, description, Markdown instructions, and optional bundled reference text. The format executes no scripts and grants no tools or permissions.

Assistant first receives compact Skill descriptions and loads the full instructions only for relevant Skills. An explicit Quick Action or slash selection guarantees that Skill is loaded. Assistant may load complementary Skills when the Author's request needs them. Product safety and capability validation take precedence over the current Author request, which takes precedence over an explicit Skill, which takes precedence over automatically selected Skills. Assistant asks when a non-safety conflict would change the intended result.

Quick Actions remain compact, discoverable Skill starters. They have the same capability access as ordinary conversation and do not invoke a separate hard-coded workflow. Dedicated Workspace Views remain usable without an Assistant conversation and may seed Assistant with a Skill and context when conversation helps.

Built-in Skills are versioned application assets. Author-created Skills, their storage scope, editing, import, sharing, executable resources, and custom tools are deferred. The catalog accepts more than one Skill source so built-ins do not become a permanent closed set.

### One bounded foreground run

Every run starts from an explicit Author request. The model may select and sequence registered read or artifact-producing tools for at most six model steps. Safe calls run without per-call confirmation. Adding the current Revision to the Style Corpus or rebuilding the Style Profile requires a server-validated request intent that names that exact action; general Article-scoped conversation does not authorize either mutation, and the model does not attest authorization. Assistant asks one concise question when a simple required parameter is missing and links to a Workspace View when the Author must manage a prerequisite.

The completion gate applies to the full run. New artifacts remain staged until the run and all required validation complete. Failure, cancellation, step exhaustion, a stale Revision, an unregistered call, or invalid output persists no new artifact as valid work. Assistant may retry once only for a classified transient failure from a side-effect-free read. Artifact-producing and validation failures do not retry automatically.

A run normally produces one primary artifact. It may produce an existing related set, such as style Findings with their correction Proposal, when the application workflow already defines that relationship. The implementation does not add general cross-artifact transactions.

Conversation uses the configured Assistant model. Each invoked capability retains its purpose-specific Editorial model selection. Existing persisted built-in Skill IDs map to the new Skill references at the compatibility boundary; stored conversation history is not rewritten.

### Quiet progress and Workspace review

The existing typed Assistant stream carries quiet, human-readable activity such as "Checking facts." Successful activity collapses to one short summary with optional local detail. It does not expose tool identifiers, prompts, private arguments, provider errors, credentials, or privileged handles.

A completed artifact produces a short conversational summary and a result card with an explicit action to review it in its owning Workspace View. Completion does not change the current view automatically. Proposal decisions, Finding resolution, Revision restoration, translation Article creation, style-profile management, and publishing remain in their current screens.

Persist an append-only minimal local activity record for each capability call: capability ID, status, request ID, base Revision, and timestamps. It follows the Article conversation lifecycle and stores no prompt, tool argument, private context, result body, secret, or raw provider response. Legacy last-capability metadata remains readable for compatibility only.

## Consequences

Assistant can interpret untagged requests and combine existing editorial work without another intent regex or skill-specific execution branch. Quick Actions keep their discoverability, while Workspace Views keep Skladno's review-heavy identity and work even when conversational orchestration is unavailable.

The capability catalog becomes an allowlist and trust boundary. Every visible capability therefore needs deterministic contract tests for validation, context authority, completion, cancellation, failure, and stale Revision handling. HTTP and Electron transports continue to expose the same renderer-safe application client and typed events.

Skill Creator, Author Skill persistence and management, MCP transport, third-party tools, background runs, direct publishing, and arbitrary capability discovery remain outside this decision.

## Verification

Deterministic tests cover untagged and explicit Skill requests, relevant Skill loading, complementary Skills, capability selection, bounded multi-step execution, missing prerequisites, selection authority, safe retry, cancellation, step exhaustion, stale Revisions, invalid calls, incomplete output, completion-gated artifact persistence, compatibility with stored built-in Skill IDs, and direct Workspace invocation.

Workspace tests verify quiet progress, stable streamed output, result cards, explicit review handoffs, keyboard access, and continued operation of dedicated Views. Regression coverage includes corrected selection scope from issue #156 and stable stream completion from issue #161.
