# Testing

Use the smallest check that can fail for the changed behavior, then run the applicable gates below. Run commands from the repository root unless a working directory is specified.

## Commands

- `npm run verify` runs the product check, lint, typecheck, and full test suite.
- `npm test --workspace <workspace>` runs the selected workspace tests.
- `npm run lint` checks import boundaries and ESLint rules.
- `npm run typecheck` checks the TypeScript project references.
- `npm run test:e2e` runs deterministic Chromium author journeys.
- `npm run product:impact -- <affected paths>` returns capabilities and scenarios that the change must preserve.
- `npm run product:check` validates canonical records, generated inventories, and product-scenario markers in workspace tests.

Source changes require lint and typecheck. Run focused tests for changed behavior. Run E2E when a renderer-to-service journey, browser interaction, responsive release state, or transport integration changes.

For documentation-only changes, inspect the diff, check local links and referenced paths, verify command examples against package scripts, and run `git diff --check`. Lint, typecheck, and application tests are unnecessary unless executable code or configuration also changes. Product-model edits require `npm run product:docs` followed by `npm run product:check`.

### Focused tests

The workspace runners differ. Appending a file to a script that already includes a test glob still selects the glob's tests.

| Target | Command | Working directory |
| --- | --- | --- |
| Web | `npm test --workspace @skladno/web -- src/workspace/EditorialWorkspace.lifecycle.test.tsx` | Repository root |
| Server or Electron | `npx tsx --test <relative-test-file.test.ts>` | `packages/server` or `packages/electron` |
| Shared | `node --test <relative-built-test-file.test.js>` | `packages/shared` |
| Repository scripts | `node --test scripts/<name>.test.mjs` | Repository root |

Before shared tests, run `npm run typecheck` from the root to refresh `dist`; these tests execute compiled JavaScript. Select existing test paths and check the workspace's `package.json` if its runner changes.

### Electron verification

Browser E2E does not exercise Electron IPC, preload isolation, native dialogs, credentials, packaging, or shutdown. For changes to these paths, run the relevant Electron and server tests and the affected desktop scenario in the [release guide](mvp-release-and-recovery.md). Report any desktop checks that could not be run separately from browser results.

## Deterministic AI tests

Provider tests use injected models, fetch implementations, or the deterministic E2E service. They require no API key or network call. Add fixtures at the narrowest existing provider or application boundary. Test stable domain events and safety behavior rather than SDK wording.

Cancellation, malformed streams, provider failures, response-storage settings, and structured output must remain deterministic. Persisted generated output is asserted only after a valid completion.

## Product evidence

A test used as automated product evidence marks every protected scenario with `// Product scenarios: <scenario-id>, ...`. The checker rejects missing and unknown markers. Update `product-model/areas` only when capability, status, contract, persistence, or visible behavior changes.

## Manual verification

Automation does not replace visual, keyboard, screen-reader, provider-quality, or recovery checks when those are part of the change. Record the environment, result, and remaining checks without private Article content, credentials, local paths, or raw provider output.

Playwright uses `.e2e-data`, starts its own loopback service and web client, and removes no author-managed data. If a port conflicts, identify its process first. Stop only a task-owned process; coordinate with the user before stopping unrelated work.

