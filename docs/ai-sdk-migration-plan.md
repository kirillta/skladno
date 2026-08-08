# Vercel AI SDK migration plan

## Status

Proposed. This document evaluates and plans a transition from LangChain.js and LangGraph to the Vercel AI SDK. It does not authorize a product-behavior change.

The evaluation was performed on August 8, 2026 against `ai` 7.0.58 and `@ai-sdk/openai` 4.0.36. Recheck the installed package documentation and current versions immediately before implementation because the AI SDK changes frequently.

## Decision

Proceed with a controlled, tests-first migration to the Vercel AI SDK behind a Skladno-owned editorial AI facade.

Use the AI SDK directly with the OpenAI provider. Do not introduce AI Gateway, `@ai-sdk/react`, or an agent abstraction as part of this migration. Skladno's current workflows are explicit, bounded editorial operations rather than autonomous agents.

The migration must preserve every existing Proposal, Finding, Revision, translation, persistence, privacy, cancellation, and error-safety contract. It replaces implementation machinery, not user-visible behavior.

## Why this fits Skladno

The current LangChain surface is narrow:

- prompt construction through `ChatPromptTemplate`;
- text and structured generation through `ChatOpenAI`;
- OpenAI Responses API continuation and storage settings;
- OpenAI web search for fact checking;
- a fixed, linear LangGraph fact-check pipeline.

The AI SDK directly supports the corresponding requirements:

| Requirement | AI SDK fit | Migration note |
|---|---|---|
| OpenAI Responses API | Strong | Use the direct OpenAI provider and Responses model factory. |
| Text streaming | Strong | Consume the complete event stream, not only `textStream`, so streamed error events cannot be missed. |
| Cancellation | Strong | Pass the request `AbortSignal` through every model call. |
| Zod structured output | Strong | Use `generateText` with `Output.object()` and retain Skladno's additional domain validation. |
| OpenAI web search | Strong | Use the provider's `webSearch` tool inside the bounded fact-check workflow. |
| Response continuation | Strong | Read the OpenAI response ID from provider metadata and pass it back only after explicit storage opt-in. |
| Deterministic tests | Strong | Use mock language models or the OpenAI provider's injectable `fetch` without a real key or network. |
| Future provider or SDK replacement | Strong | Keep all SDK-specific types behind the editorial AI facade. |
| Current fixed workflows | Better without a graph framework | Implement the linear fact-check stages as ordinary async functions. |

Reference documentation:

- [AI SDK Core](https://ai-sdk.dev/docs/reference/ai-sdk-core)
- [OpenAI provider](https://ai-sdk.dev/providers/ai-sdk-providers/openai)
- [`streamText`](https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text)
- [Structured data generation](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data)

The SDK change will not reduce model-call cost by itself. The current fact-check workflow performs claim extraction, up to twelve web-research calls, and evidence evaluation. Preserve that call structure initially so framework migration is not mixed with a quality, latency, or cost redesign.

## Target architecture

```text
HTTP and Assistant routes
    -> Skladno EditorialEngine facade
        -> AiSdkEditorialEngine adapter
            -> Vercel AI SDK
                -> OpenAI Responses API
```

The facade is owned by Skladno and speaks only in Skladno domain concepts. The adapter is the only production layer allowed to depend on AI SDK or OpenAI provider types.

### Facade responsibilities

The existing `EditorialEngine` contract is already the correct seam. Strengthen it rather than adding another generic abstraction.

It should expose explicit required operations:

```ts
export interface EditorialEngine {
    streamOperation(
        request: EditorialOperationRequest,
        signal: AbortSignal,
    ): AsyncIterable<EditorialEngineEvent>;

    streamConversation(
        request: EditorialConversationRequest,
        signal: AbortSignal,
    ): AsyncIterable<EditorialEngineEvent>;
}
```

The final names may follow the surrounding repository style, but the two capabilities should not be represented by optional method detection.

The facade owns stable contracts for:

- operation and conversation requests;
- Proposal text deltas;
- named workflow progress;
- completed Proposals, Findings, style reviews, and translations;
- cancellation and incomplete-stream behavior;
- safe error categories;
- opaque provider response identifiers where continuation is enabled.

The facade must not expose:

- AI SDK message, result, output, tool, or error types;
- OpenAI provider options or metadata shapes;
- LangChain or LangGraph concepts;
- generic provider registries;
- a home-grown imitation of the AI SDK API.

A second low-level `LanguageModelClient` interface is intentionally omitted. Add one only if a second real implementation reveals a smaller stable contract that cannot be contained inside `AiSdkEditorialEngine`.

### Composition

Move provider-specific construction out of the HTTP service into a small composition function such as `createEditorialEngine`. It resolves the active AI connection and model preferences, then creates the adapter. HTTP routes and repositories receive only the facade.

Do not add a persistent runtime feature flag or retain two production engines. Git history and focused commits provide the rollback path.

## Privacy and safety requirements

These requirements are release blockers.

### Provider storage

The evaluated OpenAI provider defaults its Responses `store` option to `true`. Every Skladno generation call must therefore set it explicitly from the existing `OPENAI_STORE_RESPONSES` configuration.

- Default requests send `store: false`.
- `previousResponseId` is sent only when storage is explicitly enabled.
- Storage-disabled requests remove obsolete local continuation state.
- Expired stored responses clear local continuation and return a safe retryable error.
- Provider-side storage remains documented as an explicit privacy opt-in.

### Streaming

AI SDK's text-only stream does not surface error parts. The adapter must consume the complete typed stream, forward text parts as Skladno deltas, and fail on error parts.

A completed event may be emitted only when:

- the stream ended successfully;
- the expected output is non-empty;
- the finish reason is acceptable;
- required structured output passed its schema;
- Skladno's domain validation passed;
- a real OpenAI response ID is present when the operation requires one.

Failed, cancelled, malformed, incomplete, or invalid calls must persist no generated content or incomplete artifact.

### Data boundaries

- API keys and environment-variable values stay in the local service.
- Selection-scoped requests send only the server-derived selection.
- Raw style corpus items remain local; only the compact Style Profile is sent.
- Translation continues to protect code, URLs, and technical names.
- Fact-check output remains advisory, Revision-tied, sourced, and uncertain where appropriate.
- Telemetry and remote tracing remain disabled for private editorial content.
- No raw provider error, prompt, credential, Article body, or corpus content appears in renderer diagnostics or logs.

## Migration phases

### Phase 0: authorize and baseline

Create a focused migration issue with explicit acceptance criteria. It must supersede the implementation-specific instruction in issue #94 to preserve LangGraph while retaining all fact-check behavior and safety requirements.

Record the baseline:

- dependency versions and lockfile;
- current typecheck and test results;
- representative prompt fixtures;
- representative editorial-quality fixtures;
- storage-disabled and storage-enabled behavior.

### Phase 1: strengthen facade contract tests

Add tests against the Skladno facade before changing the implementation:

- exact operation and conversation request mapping;
- bounded whole-Article and selection-only context;
- stable text-delta, progress, completion, and error events;
- cancellation and incomplete streams;
- no persistence before valid completion;
- safe provider, network, invalid-output, session-expiry, and malformed-stream errors;
- model preference and active connection resolution.

Make conversation a required facade capability rather than probing an optional method.

### Phase 2: add AI SDK adapter tests

Test exact provider behavior through an injected mock model or custom `fetch`:

- `store: false` is present by default;
- `previousResponseId` is absent when storage is disabled;
- enabled continuation sends the saved response ID;
- provider response IDs are read from OpenAI metadata rather than generated generic IDs;
- full-stream error parts become facade errors;
- abort reaches the provider call;
- empty output and unacceptable finish reasons are incomplete failures;
- structured output failures are invalid-output failures;
- provider messages are not exposed to callers.

### Phase 3: migrate conversation and editorial generation

- Replace `ChatPromptTemplate` with ordinary typed model messages.
- Preserve existing prompt text and context limits before attempting prompt improvements.
- Implement conversation, talking points, narrative drafting, and flow revision with `streamText`.
- Implement style review and translation with `generateText` and `Output.object()`.
- Retain Style Profile trait-ID validation.
- Retain target-language and protected-span validation.
- Keep existing SSE, artifact, Proposal Review, and persistence contracts unchanged.

### Phase 4: replace the LangGraph fact-check implementation

Implement a private fixed workflow with ordinary async functions:

1. extract up to twelve externally verifiable claims;
2. research each claim through OpenAI web search;
3. evaluate evidence into structured Findings;
4. validate status, rationale, uncertainty, source quality, and sources;
5. filter unsafe URLs and emit completed advisory Findings.

Preserve existing stage identifiers and progress events unless a separate product requirement authorizes a change. Preserve the source limit, HTTPS filtering, Revision linkage, freshness semantics, and citation persistence.

Do not use `ToolLoopAgent` for this workflow. It has a known fixed sequence, no autonomous tool choice, no branching, and no graph checkpoint state.

### Phase 5: switch composition and remove LangChain

- Construct `AiSdkEditorialEngine` through the composition function.
- Remove direct engine construction from the HTTP service.
- Remove `@langchain/core`, `@langchain/openai`, and `@langchain/langgraph`.
- Add `ai` and `@ai-sdk/openai`; retain Zod.
- Remove obsolete LangChain and LangGraph implementation files.
- Confirm the lockfile contains no unintended LangChain dependency.

### Phase 6: synchronize documentation and inventories

- Update README architecture and privacy wording.
- Replace implementation-specific LangGraph inventory text with a provider-neutral fixed fact-check workflow description.
- Preserve all implemented capability statuses unless repository evidence independently shows a limitation.
- If Article Workspace-owned paths change, run the product impact command and update the canonical product model rather than editing its generated inventory by hand.

## Required test coverage

The final change must retain or add deterministic coverage for:

- conversation with bounded recent local history;
- every built-in editorial skill;
- explicit skill precedence and one-skill maximum;
- whole-Article versus selection-scoped context;
- text streaming and named progress;
- user cancellation;
- network and provider failures;
- stream error events and incomplete streams;
- invalid structured output;
- response storage disabled by default;
- explicitly enabled response continuation;
- expired response continuation;
- style trait references;
- translation protected spans and target language;
- fact-check claims, sources, quality, uncertainty, and HTTPS filtering;
- no artifact or partial generated-content persistence after failure;
- immutable Revision and explicit Proposal acceptance behavior.

Tests must use deterministic fixtures or mocked provider responses and must not require a real API key.

## Verification

Run from the repository root:

```text
npm run lint
npm run typecheck
npm test
npm run build
npm run product:check
```

Manually verify:

- one text Proposal with response storage disabled;
- one continued editorial session with storage explicitly enabled;
- cancellation after receiving a partial delta;
- one malformed or interrupted provider response;
- one style review;
- one protected-span translation;
- one live fact check with source-link inspection;
- no credentials or private content in logs or diagnostics.

## Release criteria

Ship only if:

- renderer-visible SSE and artifact behavior remains compatible;
- every generated content change remains a Proposal until explicit acceptance;
- acceptance still creates one immutable Revision;
- failed, cancelled, incomplete, and invalid calls persist no generated content;
- storage-disabled requests demonstrably send `store: false`;
- continuation works only after explicit storage opt-in;
- selection-scoped requests contain no full Article body;
- fact-check sources and uncertainty remain intact;
- representative quality fixtures show no material regression;
- all automated and manual verification passes.

## Rollback

Implement the migration in reviewable commits: characterization tests, facade refinement, AI SDK adapter, fact-check replacement, and dependency/documentation cleanup. Do not maintain a permanent dual stack.

If a release gate fails, revert the production adapter switch while keeping framework-neutral characterization tests that remain valid. Never roll back by weakening Proposal approval, persistence, privacy, validation, or Revision safeguards.

## Deferred work

The following are outside this migration:

- multiple AI providers;
- Vercel AI Gateway;
- local models;
- autonomous multi-step agents;
- `ToolLoopAgent` adoption;
- AI SDK React hooks or UI message protocol;
- remote telemetry or DevTools in production;
- redesigning fact-check model-call count or concurrency;
- changing prompts for unrelated editorial-quality improvements.

Reconsider these only through separate product requirements and after the core editorial loop has been validated.
