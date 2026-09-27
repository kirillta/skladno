---
name: skladno-ai-debugging
description: Diagnose failed or slow Skladno Assistant and Editorial operations across AI SDK providers, completion, and Electron transport. Use for runtime AI failures, including failures that persist after a fix; not for general UI bugs or new AI features.
---

# Skladno AI debugging

Find the failing stage before changing concurrency, deadlines, retries, or validation. Recovery improvements and passing mock tests do not establish the cause of a real provider failure. If the same symptom returns, reopen the diagnosis.

## Identify the attempt and boundary

Correlate the screenshot's time with request status, duration, and stable error code. `editorial_provider_failed` can cover provider rejection and invalid output; it does not prove a connection problem. Distinguish the Assistant deadline from SDK/network timeouts. Check that the running Electron build includes the change being tested.

Locate the current owners rather than assuming every request follows the same path:

- `packages/server/src/application/assistant/`: request deadline, capability execution, completion, and recovery.
- `packages/server/src/infrastructure/editorial/`: configured engine, provider adapters, workflows, and output schemas. Fact Check separates extraction, matching/reuse, research, evaluation, and the final Assistant reply.
- `packages/server/src/infrastructure/electron/`, `packages/electron/src/presentation/preload-bridge.ts`, and `packages/web/src/application/desktop-client.ts`: error transport. A stored code and the renderer's displayed error can differ; test the context-isolated bridge separately from HTTP.

Read [ADR-007](../../../docs/development/architecture/adr-007-completion-gated-editorial-engine.md) for completion guarantees and [ADR-004](../../../docs/development/architecture/adr-004-local-diagnostics.md) before capturing evidence. Inspect only necessary request metadata; avoid dumping Article bodies, settings, or credentials. Local diagnostics use process streams and are not necessarily retained.

## Reproduce the provider boundary

Use the installed SDK's source and bundled documentation in `node_modules/ai` and the affected `node_modules/@ai-sdk/<provider>` package. Build the smallest probe that exercises the actual adapter and failing stage. Record safe stage timings, status, and allowlisted error categories; exclude raw provider errors, payloads, and secrets.

For structured-output rejection, inspect the JSON schema produced by the SDK, not just the Zod declaration. The escaped Fact Check bug was `z.string().url()` emitting `format: "uri"`, which the provider rejected before evaluation. Keep local URL validation when removing an unsupported provider constraint. Treat this as a regression example, not a rule to remove formats or validation everywhere.

A live probe requires existing authorization and an available approved connection; this skill grants neither. Prefer public synthetic input, disable response storage where supported, and avoid writing to the Author's database. Bound calls and elapsed time, stop once the cause is distinguished, and repeat only to test a specific change. Do not substitute another credential silently. A mock that accepts every schema cannot establish provider compatibility.

## Fix and verify

Add a failing regression at the relevant boundary: generated schema, adapter output, deadline recovery, or IPC error propagation. Use the [testing guide](../../../docs/development/guides/testing.md) for the correct runner; server tests use `tsx --test`, while web tests use Vitest.

Apply the smallest demonstrated fix and rerun the original probe. Preserve cancellation, stale-Revision checks, and completion-gated persistence; partial findings must remain explicitly incomplete. Follow repository product-impact requirements when behavior changes.

Remove temporary probes and instrumentation. Report the confirmed cause, test results, and remaining verification. A successful synthetic provider probe verifies that boundary, not the full Article workflow; state that limit rather than asking the Author to repeatedly retry an unverified fix.
