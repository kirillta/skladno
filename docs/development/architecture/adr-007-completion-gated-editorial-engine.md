# ADR-007: AI generation is isolated behind a completion-gated Editorial Engine

- Status: Accepted
- Date: 2026-08-21
- Updated: 2026-09-07
- Scope: AI generation, streaming, provider storage, and generated artifact persistence
- Depends on: [ADR-001](adr-001-three-layer-server-and-electron.md), [ADR-005](adr-005-article-state-and-consistency.md)

## Context

Editorial operations stream partial provider output and may fail, be cancelled, return invalid structured data, or refer to an expired provider continuation. Provider SDK types, response IDs, and defaults must not become application contracts or weaken author approval and privacy rules.

## Decision

Application services depend on Skladno's `EditorialEngine` contract. Provider SDK construction, options, metadata, tools, and errors remain in infrastructure adapters.

The infrastructure resolver constructs a common SDK Language Model for the active finite provider connection. The adapter consumes the complete provider stream, forwards safe domain events, propagates the request `AbortSignal`, and emits completion only after the stream succeeds and its required text, finish reason, structured output where required, and domain validation are valid. A successful completion receives a local identity; a provider response ID is not required. Failed, cancelled, empty, malformed, or incomplete operations persist no generated artifact.

Infrastructure keeps provider mechanics, Article context bounding, and Assistant `ToolLoopAgent` execution in focused modules. The engine factory constructs capability-specific providers such as `FactCheckProvider` and injects them into the `EditorialEngine`; the engine does not construct unused provider clients for other connections. Supporting adapters for titles, Proposal summaries, and action-intent verification remain separate and share only provider configuration.

Provider-side response storage is disabled by default where the provider exposes that control. `SKLADNO_AI_SESSION_CONTINUATION=true` opts into eligible same-Article continuation only when the provider adapter supports it. The stored provider token is separate from Skladno's local completion identity and is reused only when Article, connection, provider, and model all match. Fact checks, translations, cross-Article requests, legacy unscoped sessions, and adapters without continuation support start fresh. Provider-specific storage and continuation mechanisms remain inside infrastructure adapters.

Application errors use stable safe categories. Raw provider messages, prompts, Article bodies, credentials, and SDK types do not cross the adapter boundary or enter diagnostics.

## Consequences

The provider or SDK can change without rewriting application behavior. The adapter carries strict completion checks, and partial streamed text is presentation state rather than durable content. Continuation cannot leak between connections or models, and local artifact identity is never sent to a provider.

## Verification

Deterministic adapter and integration tests cover storage defaults, scoped eligible continuation, abort propagation, stream error parts, incomplete output, structured validation, safe errors, provider-model routing, and absence of artifact persistence before valid completion.

