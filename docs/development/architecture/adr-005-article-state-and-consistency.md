# ADR-005: Article changes use immutable Revisions and Revision-bound artifacts

- Status: Accepted
- Date: 2026-08-21
- Scope: Article, Draft, Revision, Proposal, Finding, and translation state
- Depends on: [ADR-001](adr-001-three-layer-server-and-electron.md), [ADR-002](adr-002-shared-contract-organization.md)

## Context

Skladno must recover author work, prevent delayed AI output from changing newer text, and keep every accepted change attributable. Treating the editor buffer, saved history, and generated output as one mutable record would make conflicts and recovery ambiguous.

## Decision

An Article points to its current immutable Revision. Editing creates a mutable Draft checkpoint tied to that Revision. Explicit save promotes only the matching current checkpoint into a new Revision and clears only that checkpoint.

AI-generated Proposals and advisory Findings record their base Revision. They become stale when the Article's current Revision changes. Stale output cannot change Article content. Accepting a valid Proposal creates one new Revision; rejecting or resolving advisory output creates none.

Restoring an earlier Revision appends a new Revision whose provenance identifies the source. History is never rewritten. A conflicting or retained Draft remains recoverable until the author explicitly chooses which text to use.

Translations are linked Articles with their own Drafts and Revisions. Their source Article and source Revision remain recorded so stale source relationships are visible.

## Consequences

Every durable content change is recoverable and attributable. Optimistic conflict handling is required at Draft promotion, Proposal acceptance, and Revision restoration. Generated output may need regeneration after the base Revision changes.

## Verification

Tests cover checkpoint version conflicts, exact checkpoint promotion, immutable restore, stale Proposal blocking, advisory Findings, and independently editable translations. Product scenarios remain canonical in `product-model/areas`.

