# Issue 93: complete the Assistant experience

Issue: [#93](https://github.com/kirillta/skladno/issues/93)

## Status

PR [#96](https://github.com/kirillta/skladno/pull/96) delivered the first version and marked the issue complete, but the current implementation still misses parts of the contract:

- the composer is a hand-built `contentEditable` instead of the required focused Lexical editor;
- slash invocation has no boundary rules, filtering, aliases, result count, or combobox/listbox semantics;
- Article selection scope uses selected text plus `indexOf`, so repeated text and formatted Markdown can produce the wrong offsets;
- assistant responses render as plain text instead of sanitized read-only Markdown;
- failed and cancelled attempts have no deliberate Retry action;
- the timeline does not expose every required skill-source and status indicator.

The implementation must preserve the durable conversation, streaming, cancellation, Proposal and Finding handoffs, Article-first layout, and current Assistant capability model.

## Current decisions that override the original issue

ADR-011 and the product model now allow Talking Points and Narrative Draft to use an Article selection. Translation remains whole-Article only. Keep the current capability rules instead of restoring the older compatibility list from #93.

Capability progress remains renderer-safe, human-readable activity. Do not expose internal capability or tool identifiers in the timeline.

Selection behavior must also satisfy #156. Moving focus into the Assistant preserves the captured scope. Deliberately collapsing the editor selection, editing the Article, switching Articles, or removing the chip clears or invalidates it.

The streaming completion work overlaps #161. Fix the shared timeline transition once and use it as verification for both issues.

## Implementation plan

### 1. Make Retry durable

- Change the shared Assistant start contract into a discriminated union for a new request or a retry request.
- Persist every value needed to replay an attempt, including the translation target.
- Let the server reconstruct the original author message, explicit skill, scope, and target from the stored request. The renderer sends only a new request ID and the original request ID.
- Validate that the original request belongs to the same Article and ended as failed or cancelled.
- Revalidate the current Revision and selection offsets before the provider call. A stale attempt fails with a safe recovery message.
- Reuse the existing Assistant streaming endpoint and application-client method.

Expected owners:

- `packages/shared/src/assistant/assistant.ts`
- `packages/server/src/application/assistant/assistant-service.ts`
- `packages/server/src/application/ports/assistant-store.ts`
- `packages/server/src/infrastructure/persistence/database.ts`
- `packages/server/src/infrastructure/persistence/repositories/assistant-repository.ts`
- `packages/server/src/presentation/routes/assistant-route.ts`
- existing HTTP and Electron application-client adapters

### 2. Capture exact Markdown selections

- Add a focused editor helper that clones the Lexical range selection.
- Insert collision-resistant boundary sentinels in a tagged, non-history update.
- Export normalized Article Markdown, locate and remove both sentinels, and calculate UTF-16 offsets.
- Remove the temporary nodes and restore the original selection without emitting an Article change.
- Return no selection when either sentinel is missing or ordered incorrectly. Never guess offsets.
- Store a workspace snapshot containing the Article ID, SHA-256 content fingerprint, Markdown preview, and offsets.
- Use Web Crypto for the fingerprint. Do not add a hashing dependency.
- Clear the snapshot on Article switch and deliberate deselection. Invalidate it after an Article edit.
- Before Send, promote the Draft through the existing save flow and compare the snapshot fingerprint with the promoted Revision content. Require reselection if they differ.

Expected owners:

- `packages/web/src/workspace/editor/ArticleEditorPlugins.tsx`
- a focused helper beside the Article editor
- `packages/web/src/workspace/editor/markdown.ts`
- `packages/web/src/workspace/EditorialWorkspace.tsx`
- `packages/web/src/workspace/state/assistant-messages-state.ts`

### 3. Replace the composer with Lexical

- Rebuild `AssistantComposer` with the installed Lexical packages.
- Support only text, line breaks, and one inline skill-tag node.
- Make the tag an indivisible keyboard-selectable token with an accessible name and remove action.
- Support Backspace and Delete at tag boundaries.
- Serialize author text and the skill ID separately. Keep the skill insertion offset for persisted timeline display.
- Handle paste as plain text. Pasted markup or text that resembles a tag must not create a skill node.
- Keep serialized text, skill, caret, and selection scope in the existing panel state so collapse and expansion do not lose work.
- Delete the manual DOM composer helpers once no caller remains.

Expected owners:

- `packages/web/src/workspace/components/assistant/AssistantComposer.tsx`
- one focused skill-tag node beside the composer
- `packages/web/src/workspace/components/EditorialAssistantPanel.tsx`
- `packages/web/src/workspace/components/assistant/composer-utils.ts`, removed when unused

### 4. Use one Quick actions and slash picker

- Keep one ordered six-skill registry for both entry points.
- Quick actions inserts at the last valid caret and never sends a request.
- Typing `/` opens the picker only at the start or after whitespace.
- Filter the same picker by localized skill label and typed aliases.
- Arrow Up and Arrow Down change the active option. Enter, Tab, and click replace the slash query with the skill tag. Escape closes the picker without changing text.
- Add combobox/listbox relationships, active-option state, and a polite announced result count.
- Position the popup inside the fixed footer without panel reflow.
- Keep all six skills visible. Disable Send with a localized explanation when the selected skill cannot use the current scope. Under current rules, this applies to Translation with selection scope.

### 5. Finish the timeline

- Add a small read-only Assistant Markdown renderer using the existing Lexical Markdown transformers.
- Render no raw HTML and allow only safe link schemes.
- Keep author messages and application-authored status templates as plain catalog-backed text.
- Show explicit or inferred skill source, semantic response label, timestamp, and an icon plus visible status text.
- Add Retry to failed and cancelled attempts. Tie the action to the original request ID.
- Keep streamed text visible until the persisted completion replaces it. Do not render a second full artifact body when the Workspace View owns review.
- Preserve `Review Proposal`, `View Findings`, Style Review, and Translation handoffs without moving focus or changing the current view automatically.
- Add an inline AI-unavailable action that opens Application Settings. Do not use a global notification for request-level failures.

Expected owners:

- `packages/web/src/workspace/components/assistant/AssistantTimeline.tsx`
- `packages/web/src/workspace/components/assistant/AssistantTimelineMessage.tsx`
- one small read-only Markdown component beside the timeline
- `packages/web/src/workspace/state/assistant-messages-state.ts`
- `packages/web/src/i18n/messages.ts`

### 6. Update product records

Run product impact routing before editing owner paths. Preserve the reported capabilities and scenarios unless this issue explicitly changes them.

Update the canonical records for visible selection, retry, composer, or timeline behavior:

- `product-model/areas/article-workspace.json`
- `product-model/areas/editorial-workflows.json`
- `product-model/areas/cross-cutting.json` if the transport or persisted retry contract changes

Regenerate the affected inventories. Do not edit generated inventory files directly.

## Automated verification

### Composer

- caret insertion at the beginning, middle, and end;
- replacement of the existing tag;
- Backspace, Delete, and accessible removal;
- tag-only Send;
- plain-text paste sanitization;
- slash boundaries inside words, URLs, and code-like text;
- localized filtering and aliases;
- Arrow keys, Enter, Tab, Escape, click, and ARIA relationships;
- state restoration after panel collapse and expansion.

### Article selection

- plain and partial paragraphs;
- multiple blocks and headings;
- bold, italic, links, lists, inline code, fenced code, and Unicode;
- repeated selected text with different Markdown positions;
- focus transfer into the Assistant;
- deliberate deselection, chip removal, Article editing, and Article switching;
- no Article change or history entry from sentinel capture;
- mapping failure and fingerprint mismatch recovery;
- exact request offsets against the promoted Revision.

### Timeline and Retry

- persisted greeting and per-Article history;
- streamed deltas and stable completion replacement;
- safe Markdown and raw HTML handling;
- semantic labels and explicit or inferred skill indicators;
- visible cancelled and failed states;
- retry reconstruction after reload;
- stale Revision and stale selection rejection;
- Proposal, Fact Check, Style Review, and Translation handoffs;
- no automatic Article mutation or view change.

Use focused real-Lexical tests rather than mocking editor behavior. Keep cross-component journeys in `EditorialWorkspace.test.tsx`; put node, picker, selection mapping, and Markdown parsing cases in focused test files.

## Required checks

Run:

```text
npm run product:impact -- <affected paths>
npm test --workspace @skladno/web -- <focused tests>
npm test --workspace @skladno/shared -- <focused tests>
npm test --workspace @skladno/server -- <focused tests>
npm run lint
npm run typecheck
npm test
npm run product:check
npm run build
npm run test:e2e
```

Manually verify the Electron app at 1440x1024 and 1280x800. Cover expanded, resized, collapsed, and constrained Assistant states; long timeline scrolling; keyboard-only Quick actions and slash use; selection-scoped conversation and Proposal generation; Stop and Retry; AI unavailable; stale selection recovery; and the unaffected Publish Workspace View.

## Completion

Close #93 only after the missing behavior above works and its tests pass. Update or close #156 and #161 when the shared fixes satisfy their narrower acceptance criteria. Move any lasting architectural decision into an ADR or guide, then delete this plan.
