# Issue 93: finish the Assistant experience

Issue: [#93](https://github.com/kirillta/skladno/issues/93)

## Objective

Finish the requirements that remain after commit `5232b44`. Keep the implemented durable conversation, exact selection snapshot, Retry transport, read-only Markdown, timeline labels, handoffs, and current capability rules intact.

ADR-011 and the product model are authoritative where they differ from the original issue. Talking Points and Narrative Draft accept Article selections. Translation requires the whole Article.

## Completion gate

Treat every requirement in this plan as release-blocking. For each numbered step:

1. add a focused test that fails for the missing behavior;
2. implement the smallest fix that makes the test pass;
3. run the focused test file and record the command in the PR.

The work is complete only when every requirement below has named automated or manual evidence, every required check passes, and the PR description contains the evidence table. A passing pre-existing suite is regression evidence, not completion evidence.

## 1. Replace the manual composer with Lexical

Build the Assistant composer with the installed Lexical packages and a focused node set:

- plain text and line breaks;
- one inline, non-editable skill-tag node;
- plain-text paste;
- serialized author text and structured skill ID as separate values.

The skill tag behaves as one token during caret movement and selection. It has an accessible name and remove action. Backspace and Delete remove it at either boundary. Replacing the selected skill preserves the current caret position. A tag without author text remains sendable.

Keep composer text, tag, caret, Article-selection scope, and streaming state when the panel collapses and expands. Remove the manual DOM composer helpers once Lexical owns every composer path.

Expected owners:

- `packages/web/src/workspace/components/assistant/AssistantComposer.tsx`
- a focused skill-tag node and plugin beside the composer
- `packages/web/src/workspace/components/EditorialAssistantPanel.tsx`
- `packages/web/src/workspace/components/assistant/composer-utils.ts`, deleted when unused

Step 1 is complete when focused real-Lexical tests prove caret insertion at the beginning, middle, and end; tag replacement; arrow navigation; Backspace; Delete; accessible removal; tag-only Send; plain-text paste; and collapse restoration.

## 2. Complete the shared skill picker

Use the ordered six-skill registry for Quick actions and slash invocation.

- Selecting a Quick action inserts at the last valid caret and performs no request.
- A slash opens the picker only at the start or after whitespace.
- Localized labels and aliases filter the options.
- Enter, Tab, or click replaces the entire slash query, including `/` and every typed query character, with one skill tag.
- Arrow Up and Arrow Down move the active option.
- Escape closes the picker and preserves the typed query.
- Removing the slash or moving the caret outside its query closes the slash picker.
- The composer exposes the combobox relationship, the popup is a listbox, each skill is an option, and the active option and result count are announced.
- The popup stays inside the fixed composer footer without panel reflow.

Keep an incompatible explicit tag visible. Disable Send and show the localized scope explanation until the author removes either the tag or the Article-selection chip. Under current capability rules this applies to Translation with selection scope.

Step 2 is complete when focused tests prove slash boundaries inside words, URLs, and code-like text; full query replacement; localized filtering and aliases; Arrow keys; Enter; Tab; Escape; click; zero results; ARIA relationships; Quick action caret insertion; and the incompatible-scope recovery path.

## 3. Finish contextual failure recovery

When an Assistant request fails because no usable AI connection exists, show an inline action that opens Application Settings. Keep ordinary request failures inside the Assistant timeline. Preserve focus, Article content, Draft state, Revision history, and the selected Workspace View.

Step 3 is complete when an integration test starts from an unavailable AI connection, opens Application Settings through the inline action, and proves that the Article and Workspace View did not change.

## 4. Add missing proof for the new selection, Retry, Markdown, and timeline code

The implementations added in `5232b44` need focused tests before they count as complete. Repair the implementation if any test goes red.

### Article selection

Use real Lexical editor state to prove:

- partial paragraphs, multiple blocks, headings, bold, italic, links, lists, inline code, fenced code, Unicode, and repeated selected text;
- exact UTF-16 offsets against the promoted Revision;
- no Article change, Draft change, or history entry from sentinel capture;
- scope preservation when focus moves into the Assistant;
- deliberate deselection, chip removal, Article editing, and Article switching clear or invalidate scope as specified by #156;
- missing sentinels and fingerprint mismatch produce the localized reselection path instead of guessed offsets.

### Retry

Use server and repository tests to prove:

- retry after reload reconstructs the original author text, explicit skill, skill offset, scope, and translation target;
- only failed or cancelled attempts from the same Article can be retried;
- stale Revision and stale or out-of-range selection fail before provider execution;
- a retry creates a new linked request and cannot duplicate an accepted Revision or completed artifact;
- cancellation and failure persist no partial assistant content or incomplete artifact.

### Markdown and timeline

Use focused component tests to prove:

- Markdown formatting renders read-only;
- raw HTML stays inert and unsafe link schemes are plain text;
- streamed content is replaced once by persisted completion;
- semantic response label, explicit or inferred skill source, timestamp, and icon plus visible status appear together;
- failed and cancelled attempts expose Retry tied to the original request ID;
- Proposal, Finding, Style Review, and Translation handoffs leave the current view unchanged until the author activates them;
- the timeline does not repeat a full artifact body owned by a Workspace View.

Step 4 is complete when every case above has a focused passing test. Mocked string selections do not count as selection-mapping evidence.

## 5. Update product records from the finished behavior

Before editing owner paths, run `npm run product:impact -- <affected paths>`. Update only canonical records whose visible behavior or contract changed, then regenerate their inventories. Keep generated inventories read-only.

Likely canonical records:

- `product-model/areas/article-workspace.json`
- `product-model/areas/editorial-workflows.json`
- `product-model/areas/cross-cutting.json` only if the transport or persisted contract changes again

Step 5 is complete when `npm run product:check` passes and each changed product claim points to current evidence.

## 6. Verify and hand off

Run:

```text
npm test --workspace @skladno/web -- <new focused test files>
npm test --workspace @skladno/shared -- <affected focused test files>
npm test --workspace @skladno/server -- <new focused test files>
npm run lint
npm run typecheck
npm test
npm run product:check
npm run build
npm run test:e2e
```

Manually verify the Electron app at 1440x1024 and 1280x800:

- keyboard-only Quick actions, slash filtering, tag removal, Send, Stop, and Retry;
- expanded, resized, collapsed, and constrained Assistant states;
- selection-scoped conversation and Proposal generation with formatted and repeated Markdown;
- AI-unavailable and stale-selection recovery;
- long timeline scrolling with a fixed composer;
- unchanged Publish Workspace View.

Add this table to the PR description and fill every row with a test name, command, or manual result:

| Requirement | Evidence |
| --- | --- |
| Lexical composer and skill tag | |
| Quick actions and slash picker | |
| Selection scope | |
| Retry durability | |
| Markdown and timeline | |
| AI-unavailable recovery | |
| Electron layouts and keyboard flow | |
| Full repository checks | |

Step 6 is complete when the table has no empty cells and every listed command passes. Then move any lasting decision into an ADR or guide, delete this plan, and close #93. If any row lacks evidence, keep the plan and issue open.
