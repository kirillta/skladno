# Issue 113: Bounded Assistant capabilities

## Outcome

Let Assistant choose and sequence approved Skladno capabilities from natural-language requests. Keep Quick Actions as Skill starters and keep dedicated Workspace Views as the independent places where Authors review and act on results.

The lasting design is in [ADR-011](../architecture/adr-011-assistant-skills-and-bounded-capabilities.md). Issues #156 and #161 must land first or their corrected behavior must be present on the implementation branch.

## Phase 1: Red contracts and compatibility fixtures

- Run `npm run product:impact --` for every owner path selected below. Record all matched capabilities and scenarios before changing source.
- Add failing shared-contract fixtures for Skill summaries and references, capability activity events, staged completion, and minimal execution metadata.
- Add compatibility fixtures that load every current `BuiltInSkillId`, legacy Editorial operation mapping, stored Assistant request, and completed result without rewriting persisted records.
- Replace the closed execution assumptions in new contracts while retaining read compatibility at the request and persistence boundaries.

Complete when the fixtures describe both transports, all six legacy Skill IDs load unchanged, and the new tests fail only because the catalog and loop are not implemented.

## Phase 2: Capability catalog over existing application services

- Add a server-owned catalog with declared input validation, allowed context, prerequisites, result type, retry policy, and human-readable activity for each capability.
- Adapt existing application services for Article and Revision context, artifact listing, Publishing guidance, Proposal generation, fact-checking, style review, and translation. Reuse the same services called by Workspace flows.
- Keep Author-only mutations outside the catalog. Reject unregistered calls and excess context before provider execution.
- Move purpose-specific model selection from Skill identity to the invoked Editorial capability while preserving current configured behavior.

Complete when every registered capability delegates to one validated application path, its contract test covers every declared policy, and no catalog entry can accept credentials, persistence handles, arbitrary paths, arbitrary URLs, or unauthorized Article context.

## Phase 3: Built-in Skill packages and discovery

- Move the six built-ins into versioned packages containing a stable ID, name, description, Markdown instructions, and only the reference text each Skill needs.
- Present compact descriptions during discovery. Load full instructions for relevant Skills, always including an explicitly selected Quick Action or slash Skill.
- Treat explicit Skill input as guidance through the common request path. Remove regex inference and skill-to-operation dispatch once tagged and untagged fixtures pass through the same catalog.
- Keep the catalog source-neutral so a later Author Skill source can join discovery without replacing built-in IDs.

Complete when ordinary conversation can select a capability without a tag, each Quick Action loads its Skill without bypassing selection, complementary Skills can load together, and no Skill can grant a capability or permission.

## Phase 4: Six-step completion-gated tool loop

- Implement one provider-neutral Assistant loop behind `EditorialEngine` with a fixed six-step limit, cancellation, validated tool calls, and safe error mapping.
- Stage new artifacts for the run. Commit them only after valid completion; discard them on cancellation, failure, exhaustion, stale Revision, or malformed output.
- Permit one automatic retry only for a catalog-classified transient failure on a side-effect-free read.
- Keep one primary artifact unless an existing workflow already owns a related set. Preserve current style Findings and Proposal behavior rather than adding a general transaction system.
- Persist capability name, status, request ID, and base Revision with the Assistant request. Store no tool arguments, prompts, private result bodies, secrets, or raw provider output.

Complete when deterministic fixtures cover selection, multi-step composition, step exhaustion, safe retry, rejected retry, cancellation, stale Revision, invalid calls, coupled style output, and absence of durable partial artifacts.

## Phase 5: Quiet progress and Workspace handoffs

- Extend the existing Assistant event stream and both HTTP and Electron validation paths with renderer-safe activity and completion data.
- Render quiet human-readable activity that collapses after completion. Keep diagnostics available without putting implementation names or raw failures in the transcript.
- Show one short completion summary and a result card with an explicit review action. Preserve the current Workspace View until the Author follows that action.
- Keep dedicated Views independently callable. Their direct actions and Assistant entry points must use the same capability contracts.
- Preserve selection scope through deselection and stable streamed content through completion, with regression coverage for issues #156 and #161.
- Follow the UI design system and inspect desktop, narrow, keyboard, screen-reader, cancellation, failure, and reduced-motion states.

Complete when every artifact routes to its owning View, no handoff mutates the Article, direct View workflows remain usable, activity stays secondary to the conversation, and browser plus Electron tests observe the same typed sequence.

## Phase 6: Product evidence and cleanup

- Update `product-model/areas/editorial-workflows.json` and any other matched canonical areas when the implementation changes their contracts, persistence, or visible behavior.
- Regenerate affected inventories and run `npm run product:check`.
- Remove obsolete regex routing and single-operation execution branches after compatibility tests pass. Retain only the boundary mappings needed for persisted data and older clients.
- Update Author-facing guidance for Skills, Quick Actions, selection authority, quiet activity, and Workspace review handoffs.
- Delete this plan after the implementation lands and its lasting information has moved to the ADR, glossary, product model, tests, and guides.

Complete when generated inventories match the canonical model, searches find no active caller of obsolete routing, every matched product scenario has evidence, and only deliberate compatibility code remains.

## Checks

- Run focused shared, Assistant service, provider adapter, application-service, HTTP, Electron IPC, persistence, workspace state, composer, timeline, and Workspace View tests.
- Run `npm run lint`, `npm run typecheck`, `npm run product:check`, and the relevant workspace test commands from the testing guide.
- Manually exercise untagged conversation, every built-in Quick Action, a complementary-Skill request, a selection-scoped refusal to expand context, cancellation, stale Revision, loop exhaustion, and each review handoff in packaged Electron.
- Report commands, outcomes, the packaged Electron checks, and any remaining manual verification.

## Explicitly deferred

- Author-created Skill storage, ownership scope, editing, deletion, import, export, and sharing.
- Executable Skill scripts, custom tools, custom permissions, and built-in overrides.
- MCP or third-party transport, arbitrary API discovery, and user-installed capabilities.
- Background or autonomous runs, direct publishing, and automatic Article mutation.
- Configurable loop limits and general multi-artifact transactions.

## Follow-up

[Issue #177](https://github.com/kirillta/skladno/issues/177) owns the Skill Creator, Author Skill validation, testing, storage scope, and lifecycle. It follows #113 and is assigned to the P6 Assistant experience milestone.
