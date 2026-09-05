# Context-efficient agent work: remaining validation

## Status

The [workflow](../guides/context-efficient-agent-work.md), AGENTS.md pointer, and workspace ownership map exist. Workspace tests now have lifecycle, Assistant, layout, and Article-control entry points. Settings tests have AI, general, and persistence entry points.

This plan remains open for baseline and pilot evidence. The repository artifacts alone do not prove lower model consumption or preservation of every assertion from the original test files. The linked guide owns the working procedure; this plan owns only the remaining validation.

## Baseline

The original investigation reported about 8.5 million tokens across 71 model requests, with late requests carrying about 183,000 input tokens. These are historical aggregate observations, not a reproduced baseline.

Record that run and two additional comparable tasks, preferably including renderer and non-renderer work. For each, record model requests, total input tokens, largest context, tool-call count and output size, full-file reads over 250 lines, focused and broad check counts, and corrective continuations.

Store aggregate numbers only. Use authorized, available measurement data; if it is unavailable, record the gap. Keep prompts, Article content, local paths, raw logs, and private session data out of the repository.

## Pilot

Apply the published workflow to three representative tasks:

- a focused production TSX change;
- a renderer change crossing component and state ownership;
- a non-renderer TypeScript change.

Record the baseline metrics for each task and compare like-for-like work where possible. Explain full-file reads over 250 lines, repeated broad checks, and dependency-source inspection. Confirm that final production-path review finds no omitted caller or acceptance criterion.

The pilot passes when median input tokens per model request and total tool-output size both decrease, with product safeguards and required verification preserved. If they do not, revise the workflow before splitting more files.

## Verify and close

Confirm the test splits preserve their original assertions and product-scenario markers using the relevant implementation diff. Run the affected checks from the [testing guide](../guides/testing.md); documentation edits alone do not require repeating application tests.

Close only when the three-task baseline, three-task pilot comparison, and test-preservation evidence are recorded in the implementation PR or linked evidence. Keep lasting workflow changes in the guide and renderer structure rules in [ADR-003](../architecture/adr-003-web-feature-oriented-react-architecture.md), then delete this plan.
