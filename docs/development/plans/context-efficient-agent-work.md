# Context-efficient agent work

## Objective

Reduce Codex usage consumed by repeated repository context while preserving implementation quality, product safeguards, and required verification. The policy applies to every coding task. TypeScript and TSX receive specific guidance because renderer work often combines component structure, state ownership, accessibility, localization, and broad component tests.

The target is fewer and smaller model round trips, not smaller files for their own sake. Cached input still contributes to usage, so repeatedly presenting an enlarged thread is the main cost to control.

## Evidence and working theory

The investigated run consumed about 8.5 million tokens across 71 model requests. Near the end, individual requests carried about 183,000 input tokens. Tool output, repeated validation, dependency-source inspection, premature completion, and corrective follow-up turns enlarged the thread.

TSX was not the main source in that run, but its usual dependency breadth makes the same failure mode more likely. The current renderer has two clear test hotspots:

- `packages/web/src/workspace/EditorialWorkspace.test.tsx`, about 775 lines;
- `packages/web/src/settings/ApplicationSettings.test.tsx`, about 652 lines.

Most production TSX files are already moderate in size. Do not introduce repository-wide line limits or split components without an ownership reason.

## Constraints

- Keep the existing architecture and product guarantees intact.
- Keep `AGENTS.md` short. Put conditional detail in one linked guide.
- Prefer existing commands and test-runner filtering over new tooling.
- Do not add context-accounting scripts that depend on private Codex session files.
- Do not change product behavior or the product model unless implementation work uncovers a real behavior change.
- Extract code only when the result has a distinct state, test, or visual responsibility, as required by ADR-003.

## Completion gate

Each phase ends with a reviewable artifact and named evidence. The work is complete when the repository contains one authoritative workflow, the two known test hotspots have focused entry points, a renderer ownership map supports targeted discovery, and three representative follow-up tasks have recorded before-and-after consumption data.

## 1. Establish a reproducible baseline

Record a compact baseline from the investigated run and two additional recent tasks, preferably one renderer task and one non-renderer TypeScript task. For each task record:

- total model requests and total input tokens;
- largest input context;
- number and output size of tool calls;
- full-file reads over 250 lines;
- focused and broad verification invocations;
- restarts or corrective follow-up turns caused by premature completion.

Store aggregate numbers only. Do not commit prompts, Article content, local paths, raw logs, or private session data.

Phase 1 is complete when the plan or its implementation PR has a three-row baseline table and identifies which costs the repository can influence.

## 2. Add one context-efficient workflow

Create `docs/development/guides/context-efficient-agent-work.md`. Add one conditional pointer in `AGENTS.md` for coding tasks that require broad repository exploration, TypeScript or TSX work, or more than one verification loop.

The guide must define this sequence:

1. Map the change with `rg`, product impact, direct callers, and direct imports.
2. Read targeted ranges around relevant symbols. Read a full file only when its complete structure is necessary.
3. Keep one short working ledger containing the goal, owners, confirmed flow, decisions, checks passed, and remaining work.
4. Implement against the smallest runnable test that can fail for the requested behavior.
5. Run broad gates once after the focused loop passes.
6. Check every acceptance criterion against the production caller before reporting completion.

The guide must also set practical output rules:

- return the failing diagnostic or a short success summary from checks;
- use targeted diff hunks, `git diff --stat`, and `git diff --check` instead of dumping complete diffs;
- separate source inspection from test execution so test output cannot hide source evidence;
- inspect installed dependency source only to answer a named question that local types and targeted documentation did not answer;
- compact or start a clean continuation when the working ledger is sufficient and raw history no longer helps.

Do not duplicate the testing guide, ADRs, product-impact instructions, or TypeScript style rules. Link to their authoritative documents.

Phase 2 is complete when an agent can follow the guide without loading unrelated references and every step has a checkable stopping condition.

## 3. Define the TSX discovery path

Add a renderer section to the new guide. It should direct agents through this ownership order:

1. owning component or view;
2. direct state owner or hook;
3. closest focused test;
4. shared UI primitive, localization entry, or application-client boundary only when the change crosses it;
5. parent composition root only when wiring changes.

Require symbol and import searches before full reads. Treat `.tsx` as a signal that several concerns may meet, not as a reason to load the whole feature.

Document the extraction test from ADR-003. A component, hook, helper, or fixture moves only when it has an independent caller, test contract, state responsibility, or visual responsibility. Keep single-use local helpers beside their caller.

Phase 3 is complete when the TSX path covers component behavior, state orchestration, accessibility, localization, and integration wiring without requiring a full workspace scan.

## 4. Make large tests independently addressable

Split the two known hotspot tests by product behavior while retaining their existing assertions and product-scenario markers.

Suggested boundaries for the workspace tests:

- Article lifecycle and Draft behavior;
- Assistant behavior;
- layout, tabs, and focus mode;
- Revisions, Proposals, Findings, translations, and publishing only where the existing cases justify separate files.

Suggested boundaries for Settings:

- AI connections;
- appearance and formatting;
- updates and diagnostics;
- general settings only where the existing cases justify it.

Reuse one small colocated test utility for genuinely shared render setup and data builders. Keep scenario-specific fixtures in the test that owns them. Preserve real component behavior and avoid a custom test framework.

Add or confirm focused npm commands that accept an individual test path or test name. Do not add wrapper scripts when the existing Vitest invocation already works.

Phase 4 is complete when each behavioral area can be inspected and run without loading either original 600-line-plus test file, all moved assertions remain present, and focused tests pass.

## 5. Add a renderer ownership map

Add a short workspace ownership map to `docs/development/guides/context-efficient-agent-work.md`. Describe only information that is expensive to rediscover:

- composition roots;
- state owners;
- Article edit and persistence flow;
- Assistant request and response flow;
- feature-to-test ownership;
- boundaries to `application-client`, shared contracts, and Electron.

Keep commands, directory listings, and rules in their existing sources of truth. The map should point to ADR-003, the UI design system, and the testing guide rather than restating them. Apply the same approach to Settings only if the baseline or pilot shows repeated discovery there after its tests are split.

Phase 5 is complete when a reader can identify the first production file and focused test for a workspace change from the map alone.

## 6. Pilot and measure

Use the workflow on three representative tasks:

- one focused production TSX change;
- one renderer change that crosses component and state ownership;
- one non-renderer TypeScript change.

For each task record the same aggregate metrics as Phase 1. Compare like-for-like tasks where possible. The pilot succeeds when:

- no task performs an unexplained full-file read over 250 lines;
- broad verification runs once after focused checks pass, unless a failure requires rerunning it;
- dependency-source inspection has a named unresolved question;
- the final completion review finds no omitted production caller or acceptance criterion;
- median input tokens per model request and total tool-output size both decrease from the baseline.

If the numbers do not improve, adjust the guide before splitting more production files. File churn is not a substitute for a tighter process.

## 7. Verify and close

Run the checks appropriate to the files changed during implementation:

```text
npm test --workspace @skladno/web -- <each focused test file>
npm run lint
npm run typecheck
npm test
npm run product:check
git diff --check
```

Run `npm run product:impact -- <affected paths>` before changing an existing behavior owner. Update canonical product records only if visible behavior, contracts, persistence, or capability status changed.

Before closing:

- move the lasting workflow into the new guide and the short `AGENTS.md` pointer;
- keep ADR-003 authoritative for renderer structure;
- record the baseline and pilot comparison in the implementation PR;
- delete this plan after all phases pass.

The work remains open if the guide exists but the pilot does not show lower consumption, or if the test split loses assertions or product evidence.
