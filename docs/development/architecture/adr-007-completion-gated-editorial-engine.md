# ADR-007: AI generation is isolated behind a completion-gated Editorial Engine

- Status: Accepted
- Date: 2026-08-21
- Scope: AI generation, streaming, provider storage, and generated artifact persistence
- Depends on: [ADR-001](adr-001-three-layer-server-and-electron.md), [ADR-005](adr-005-article-state-and-consistency.md)

## Context

Editorial operations stream partial provider output and may fail, be cancelled, return invalid structured data, or refer to an expired provider response. Provider SDK types and defaults must not become application contracts or weaken author approval and privacy rules.

## Decision

Application services depend on Skladno's `EditorialEngine` contract. Provider SDK construction, options, metadata, tools, and errors remain in infrastructure adapters.

The adapter consumes the complete provider stream, forwards safe domain events, propagates the request `AbortSignal`, and emits completion only after the stream succeeds and its required text, finish reason, structured output, domain validation, and provider metadata are valid. Failed, cancelled, empty, malformed, or incomplete operations persist no generated artifact.

Provider response storage is disabled by default. `SKLADNO_AI_SESSION_CONTINUATION=true` opts into eligible same-Article continuation. A previous provider response ID is used only when storage is enabled and the operation permits continuation. Fact checks, translations, and cross-Article requests start fresh.

Application errors use stable safe categories. Raw provider messages, prompts, Article bodies, credentials, and SDK types do not cross the adapter boundary or enter diagnostics.

## Consequences

The provider or SDK can change without rewriting application behavior. The adapter carries strict completion and metadata checks, and partial streamed text is presentation state rather than durable content.

## Verification

Deterministic adapter and integration tests cover storage defaults, eligible continuation, abort propagation, stream error parts, incomplete output, structured validation, safe errors, and absence of artifact persistence before valid completion.

