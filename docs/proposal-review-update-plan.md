# Proposal Review screen update plan

The Proposal Review update should be implemented as the first, self-contained slice of [issue #59](https://github.com/kirillta/skladno/issues/59). Revision History should remain a separate follow-up slice within the same issue.

## Current baseline

- A dedicated Proposal Review tab, partial selection, stale blocking, one-revision acceptance, and rejection already exist.
- The current UI is limited to checkboxes with stacked diffs.
- Missing pieces are bulk actions, explicit pending/accepted/rejected states, change navigation, preservation warnings, safe whole-proposal fallback, conflict recovery, and richer provenance.
- Dependencies #6, #55, and #57 are closed. [Issue #58](https://github.com/kirillta/skladno/issues/58) remains open, but its current assistant handoff is sufficient to begin.

## Proposed interaction

Use the reference mockup's hierarchy--summary header, bulk actions, and original/proposed cards--while preserving Skladno's tokens and accessibility conventions.

- Start every reliable block as `pending`.
- Per-block Accept and Reject update local review decisions only; they never create Revisions.
- **Accept all** applies the complete proposal immediately through one acceptance request.
- After all blocks are individually resolved, **Apply accepted changes** applies the accepted subset through one request and creates exactly one Revision.
- **Reject all** clears the proposal without touching Article content or Revision history.
- Accepted and rejected blocks remain visible with explicit text status and icons; color is supplementary.
- Previous and Next controls move focus to change cards without stealing focus when the view first opens.
- Do not fabricate natural-language rationales like those in the mockup: the current Proposal contract does not supply them. Use deterministic labels such as **Replacement - Change 2 of 5**, plus the Editorial Operation name when available.

## Implementation plan

### 1. Add a Proposal Review presentation model

Create `proposal-review-presentation.ts` beside `ProposalReviewView.tsx`. It should derive:

- addition, removal, or replacement type;
- total, pending, accepted, and rejected counts;
- ordered navigation data;
- whether block-level application passes invariants;
- URL, numeric-literal, and inline/fenced-code preservation warnings;
- an honest advisory for changed prose claims; never claim that factual meaning was preserved automatically.

### 2. Replace checkbox selection with explicit decisions

Update `editorial-proposal-state.ts` to hold `pending | accepted | rejected` per change. Convert accepted decisions to the existing `Set<string>` only when calling `applyProposalChanges`.

Keep the Proposal and decisions until acceptance succeeds; errors must not discard the review.

### 3. Build the mockup-aligned screen

Refactor `ProposalReviewView.tsx` into:

- a sticky summary and action header;
- a preservation-warning summary;
- a navigable change-card list;
- visible per-card state and text-labelled actions;
- side-by-side Original and Proposed content using the existing editorial typography;
- stacked columns at constrained widths;
- a dedicated no-change state with only a dismiss action.

Reuse the existing `Diff` primitive, adding the required striped non-color treatment to its column layout. Do not add a component library or parallel styling layer.

### 4. Implement the safe fallback and stale path

Before allowing partial decisions, validate that change IDs and ranges are ordered and that applying all blocks reconstructs `proposedContent` exactly.

If validation fails, show the whole original/proposed comparison and allow only whole-proposal acceptance against the verified base Revision.

For stale Proposals:

- show the whole Proposal for review;
- disable every acceptance path;
- keep rejection available;
- offer **Review current article** and **Regenerate in Assistant** actions;
- expand and focus the assistant through the existing workspace layout state.

### 5. Handle acceptance races explicitly

The server already checks `baseRevisionId`. If acceptance returns `ArticleRevisionConflictError`, adopt the returned current Article state, retain the Proposal, and transition the screen to the stale presentation instead of showing only a generic notification.

Acceptance remains one `acceptProposal` call and one immutable Revision.

### 6. Record useful provenance without changing the API contract

Continue using the open provenance record, adding:

- `baseRevisionId`;
- accepted change IDs or `wholeProposal: true`;
- the resolved Assistant skill or Editorial Operation when available.

Track the resolved skill through the Assistant completion handoff. Fall back to the existing generic **Accepted AI proposal** provenance when unavailable.

### 7. Preserve workspace and focus behavior

Thread navigation callbacks through `WorkspaceViewRouter.tsx` and `ArticleWorkspace.tsx` for Write and Assistant handoffs. Preserve Article selection and editor selection when moving among the Assistant, Proposal Review, and Write.

### 8. Update localized copy and product evidence

Add typed ICU messages in `packages/web/src/i18n/messages.ts`, including pluralized counts, statuses, navigation, warnings, fallback, stale recovery, and accessible labels.

Update these canonical capabilities and regenerate their inventories:

- `workspace.proposal.explicit-acceptance` in `product-model/areas/article-workspace.json`;
- `editorial-workflows.proposal-lifecycle` in `product-model/areas/editorial-workflows.json`;
- `cross-cutting.accessibility` in `product-model/areas/cross-cutting.json`.

## Expected files

- `packages/web/src/workspace/views/ProposalReviewView.tsx`
- `packages/web/src/workspace/views/ProposalReviewView.test.tsx`
- `packages/web/src/workspace/views/proposal-review-presentation.ts`
- `packages/web/src/workspace/views/proposal-review-presentation.test.ts`
- `packages/web/src/workspace/state/editorial-proposal-state.ts`
- `packages/web/src/workspace/state/assistant-messages-state.ts`
- `packages/web/src/workspace/state/article-workspace-state.ts`
- `packages/web/src/workspace/components/WorkspaceViewRouter.tsx`
- `packages/web/src/workspace/components/ArticleWorkspace.tsx`
- `packages/web/src/workspace/EditorialWorkspace.tsx`
- `packages/web/src/ui/primitives.tsx`
- `packages/web/src/i18n/messages.ts`
- relevant workspace and catalog tests
- affected canonical product-model JSON files and generated inventories

## Verification

Add coverage for:

- additions, removals, replacements, and no-change Proposals;
- individual and bulk decisions;
- exactly one acceptance request for partial and full acceptance;
- rejection producing no Article or Revision-history change;
- URL, number, and code warnings;
- malformed or unreliable blocks using whole-proposal fallback;
- stale-at-render and conflict-during-acceptance paths;
- keyboard navigation and visible non-color statuses;
- large Proposals at 1280 x 800 with the Article Status Bar still visible;
- Assistant-to-review and stale-review-to-Assistant focus restoration.

Run focused web and catalog tests, followed by:

```powershell
npm run lint
npm run typecheck
npm run product:docs
npm run product:check
```

Visually verify the result at 1440 x 1024 and 1280 x 800 with supporting panels both expanded and collapsed.

## Revision History boundary

Revision History's missing **Compare with current** action and detailed operation-provenance presentation should be planned as the second #59 slice. Its existing preview, immutable restore, and confirmation behavior should remain untouched during the Proposal Review update.
