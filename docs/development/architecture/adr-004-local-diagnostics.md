# ADR-004: Local diagnostics use redacted process streams

- Status: Accepted
- Date: 2026-08-19
- Scope: `packages/server`

## Context

Skladno needs local operational diagnostics for service startup, recoverable
failures, and backup failures. Its logs must not expose API keys,
environment-variable values, or private Article and model bodies.

## Decision

The server has one diagnostics boundary. It writes JSON Lines to stdout for
successful startup and stderr for failures. It records only stable event
context and safe error metadata. It excludes raw error messages, stacks,
request URLs, identifiers, request bodies, Article bodies, model bodies, and
environment-variable values.

The diagnostics boundary catches its own failures. It does not create a log
file, retain logs, or add a renderer-visible settings control.

## Consequences

Host process and system logs can collect diagnostics without a second local
data store. Operators who need retained or routed logs configure that outside
Skladno.

## Verification

`packages/server/src/infrastructure/diagnostics/local-diagnostics.test.ts`
checks redaction, safe error metadata, and writer-failure isolation.
