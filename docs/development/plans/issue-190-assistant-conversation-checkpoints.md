# Issue #190 Assistant conversation checkpoints

Issue: <https://github.com/kirillta/skladno/issues/190>

## Goal

Let an Author return to the point immediately before any persisted Author
message was sent. Restoration rejects that message, its request and output,
and the later active conversation. It moves the selected message back into the
Composer for editing.

When the checkpoint links to an Article Revision, restoration makes that
Article content current by appending a new immutable Revision. It never
deletes, rejects, or hides a Revision.

## Product rules

### Checkpoint boundary

- Every persisted Author message is an eligible checkpoint anchor.
- The checkpoint represents the state immediately before that message was
  sent.
- Restoring it removes the selected Author message, its request and response,
  and every later message and request from the active conversation.
- Every Proposal, Finding, prepared translation, retry, and incomplete request
  produced by the rejected tail becomes non-actionable.
- Earlier conversation remains unchanged.
- After the server transaction succeeds, the renderer restores the selected
  message text, Skill tag, target language, and caret position to the Composer.
- An old Article selection is not recreated because its offsets and content
  may no longer be valid. The Composer identifies that the original request
  used a selection.
- If the Composer already contains unsent text, confirmation warns that the
  restored message will replace it.

### Revision linking

- Sending an Assistant request continues to promote the current Draft before
  creating the request. If promotion fails, Skladno creates neither the
  request nor its checkpoint.
- The Author message checkpoint stores the request's resulting
  `baseRevisionId`. This is the exact Article content that existed before the
  message was sent.
- Existing Author messages use their persisted request `baseRevisionId`
  without rewriting conversation history.
- The checkpoint contract permits a missing Revision link for legacy,
  imported, or future conversation records.
- A linked Revision must belong to the same Article. A missing or mismatched
  link fails the entire operation instead of falling back to a
  conversation-only restore.

### Article restoration and preservation

- A linked checkpoint appends a Revision with restore provenance pointing to
  the checkpoint Revision. It does not calculate or apply a text diff.
- The appended Revision becomes current even when its content matches the
  current Article content.
- A checkpoint without a Revision truncates the conversation and rejects its
  later artifacts without changing the Article or Draft.
- Conversation restoration never deletes, rejects, or hides Article
  Revisions. Revisions created after the checkpoint remain visible and
  selectable in Revision History after navigation and restart.
- Restoring one of those displaced Revisions later appends another immutable
  restore Revision through the existing flow.
- The confirmation names the linked Revision by its visible number or
  description, never by its raw identifier.

### Draft handling

- If a linked checkpoint is restored while a Draft exists, confirmation must
  explain that the Draft cannot remain current against the restored Revision.
- "Save current work and restore" is the default. It promotes the Draft to an
  immutable Revision before appending the checkpoint restoration Revision.
- "Discard Draft and restore" remains an explicit destructive choice.
- Preserving or discarding the Draft, rejecting the conversation tail and its
  artifacts, and appending the restore Revision are one SQLite transaction.
- A failure leaves the Draft, current Revision, conversation, and artifacts
  unchanged.

### Confirmation and races

- The server supplies the exact number of rejected messages and requests,
  counts for affected Proposals, Findings, translations, and retries, whether
  Article content will be restored, and whether a Draft decision is required.
- Preview returns an opaque tail token. Confirmation sends it back.
- If the conversation changes before confirmation, restoration fails and asks
  the Author to review updated details.
- The operation cancels or invalidates an in-progress rejected request so late
  provider output cannot persist.

### Keyboard and accessibility

- The checkpoint action appears below each Author message and uses the existing
  compact button treatment and semantic tokens.
- Tab and Shift+Tab continue to move between Workspace focus areas.
- Up and Down continue to scroll the Assistant conversation.
- Left and Right move chronologically through review, retry, and checkpoint
  actions.
- Home and End move to the first and last conversation action.
- Enter and Space activate the focused action.
- Do not add a Ctrl-modified navigation scheme. It would conflict with native
  text and assistive-technology conventions and ADR-012.
- The accessible name identifies the Author message time and states that later
  conversation and work will be rejected.
- The confirmation dialog owns focus while open. Closing it returns focus to
  the originating Author message.

## Implementation plan

Execution: **solo**. The contract, SQLite transaction, transports, and renderer
state form one tightly coupled change. Delegation would require coordinating
the same boundary across owners and is unlikely to save time.

### 1. Shared contract

Extend the Assistant contracts in `packages/shared/src/assistant/assistant.ts`:

- checkpoint preview and restore input/result types;
- rejected-tail counts grouped by work type;
- Draft handling mode;
- opaque tail token;
- HTTP path builders and application-client methods.

Add the corresponding finite Electron method to
`packages/shared/src/application/desktop/electron-ipc.ts`.

Reuse request and message contracts already present. Do not add a generic undo
framework or conversation-branch abstraction.

### 2. Persistence and atomic restore

Add the minimum forward-only migration needed to mark editorial artifacts as
rejected while retaining their local audit data. Active artifact queries must
exclude rejected artifacts.

Add a focused checkpoint persistence operation beside
`AssistantRepository`. In one immediate SQLite transaction it must:

1. validate Article ownership, Author-message eligibility, the Revision link,
   and the tail token;
2. determine the selected request and complete later tail;
3. preserve or discard the current Draft according to the confirmed mode;
4. mark tail artifacts rejected;
5. remove the selected message/request and later records from the active
   conversation;
6. append the restore Revision when linked;
7. return the surviving conversation, current Article state, and Composer
   restoration data.

Use the existing Revision insertion helper and provenance rules. Do not route
the transaction through nested repository transactions.

Update Fact Check, Proposal, and translation reads so rejected artifacts cannot
remain actionable. Revision listing must continue returning every immutable
Revision, including Revisions displaced by checkpoint restoration.

### 3. Application service and transports

Add preview and restore operations to `AssistantService`, then expose them
through:

- `packages/server/src/presentation/routes/assistant-route.ts`;
- `packages/server/src/presentation/routes/create-presentation-router.ts`;
- `packages/web/src/application/http/article-client.ts`;
- `packages/server/src/infrastructure/electron/electron-ipc-invoke-adapter.ts`;
- `packages/electron/src/presentation/preload-bridge.ts`.

Transport validation accepts only the checkpoint message ID, opaque tail token,
and valid Draft handling mode. Errors remain renderer-safe and contain no
Article or message content.

### 4. Renderer state

Extend Assistant state ownership under `packages/web/src/workspace/state/` to:

- load a checkpoint preview;
- stop a rejected active stream before confirmation;
- run restoration without changing local state until the server succeeds;
- replace the local conversation with the returned surviving messages;
- clear rejected Proposal, Finding, translation, and retry state;
- apply the returned current Revision and Draft state;
- restore the selected Author input to the Composer.

Keep orchestration in state modules. Timeline components render prepared state
and invoke explicit callbacks.

### 5. Renderer interaction

Update the Assistant timeline and message components to render the compact
checkpoint action only for persisted Author messages. Add the confirmation
dialog with localized counts, Revision outcome, Draft choice, and Composer
replacement warning.

Update the existing Assistant action navigation for Home and End while
preserving ADR-012 Left, Right, Up, Down, and focus-area behavior.

Put all visible and accessible copy in
`packages/web/src/i18n/messages.ts`, using ICU plurals for counts.

### 6. Product model

Update `product-model/areas/editorial-workflows.json` and
`product-model/areas/article-workspace.json` to record:

- Author-message checkpoints and Composer restoration;
- atomic conversation and Article restoration;
- rejected Assistant artifacts;
- immutable, reachable displaced Revisions;
- Draft preservation and explicit discard;
- keyboard and screen-reader behavior.

Add product scenarios for conversation-only restoration, linked restoration,
Draft preservation, explicit Draft discard, stale artifacts, rollback, race
conflict, displaced Revision access, restart persistence, and keyboard use.

## Verification

### Focused automated checks

- Repository tests cover conversation-only restore, linked Revision restore,
  selected-request inclusion, artifact rejection, Draft preservation, explicit
  discard, tail-token conflict, late completion rejection, and forced rollback.
- Repository and Revision History tests prove a displaced later Revision remains
  listed, selectable, and restorable after reopening SQLite.
- Server integration tests cover HTTP preview and restore with renderer-safe
  errors.
- Electron adapter and preload tests cover the new finite operation.
- Timeline tests cover Author-only eligibility, exact confirmation copy, focus
  return, Left/Right/Home/End navigation, and Enter/Space activation.
- Workspace tests cover Composer restoration, non-restoration of stale Article
  selection, existing Composer replacement warning, state cleanup, Article
  switching, and reload.
- One deterministic E2E journey covers preview, Draft preservation, restore,
  Composer editing, and displaced Revision access.

### Required gates

Run the focused tests first, then:

```text
npm run product:impact -- <changed paths>
npm run product:docs
npm run product:check
npm run lint
npm run typecheck
npm run test:e2e
```

Run applicable server and Electron tests with `npx tsx --test` and the focused
web suites with `npm test --workspace @skladno/web -- <test path>`.

### Manual verification

In Electron, verify the expanded and collapsed Assistant, a long conversation,
keyboard-only restoration, screen-reader names, non-empty Composer warning,
Draft preservation and discard, Article switching, restart persistence, and
restoring a displaced later Revision from Revision History.

## Completion condition

The work is complete when an Author can edit from any persisted Author message,
reject the complete Assistant tail atomically, restore the linked Article state
without losing access to any Revision, and recover the result after restart.
