# Testing

Use the smallest check that can fail for the changed behavior, then run the repository gates required by `AGENTS.md`.

## Commands

- `npm test --workspace <workspace>` runs the selected workspace tests.
- `npm test --workspace <workspace> -- <test-file>` runs a focused test file when the workspace runner accepts a path.
- `npm run lint` checks import boundaries and ESLint rules.
- `npm run typecheck` checks the TypeScript project references.
- `npm run test:e2e` runs deterministic Chromium author journeys.
- `npm run product:impact -- <affected paths>` returns capabilities and scenarios that the change must preserve.
- `npm run product:check` validates canonical product records and generated inventories.

Source changes require lint and typecheck. Run focused tests for changed behavior. Run E2E when a renderer-to-service journey, browser interaction, responsive release state, or transport integration changes.

## Deterministic AI tests

Provider tests use injected models, fetch implementations, or the deterministic E2E service. They require no API key or network call. Add fixtures at the narrowest existing provider or application boundary. Test stable domain events and safety behavior rather than SDK wording.

Cancellation, malformed streams, provider failures, response-storage settings, and structured output must remain deterministic. Persisted generated output is asserted only after a valid completion.

## Product evidence

A test used as product evidence names the protected scenario with a `product:` comment or an equally direct test name. Update `product-model/areas` only when capability, status, contract, persistence, or visible behavior changes.

## Manual verification

Automation does not replace visual, keyboard, screen-reader, provider-quality, or recovery checks when those are part of the change. Record the environment, result, and remaining checks without private Article content, credentials, local paths, or raw provider output.

Playwright uses `.e2e-data`, starts its own loopback service and web client, and removes no author-managed data. Stop conflicting local development processes before running it.

