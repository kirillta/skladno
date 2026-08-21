# Accessibility release walkthrough plan

[Issue #125](https://github.com/kirillta/skladno/issues/125) should produce a repeatable manual accessibility walkthrough and a dated release result for Application Settings and the full Editorial Workspace. Use the current Windows Chromium application as the release target. Electron distribution and a cross-browser matrix remain outside the parent release-hardening scope.

## Current baseline

- The workspace has six implemented Workspace Views: Write, Proposal Review, Revision History, Fact Check, Style Profile, and Translations.
- Publishing copy and profile controls live in the Article Status Bar. There is no separate Publishing Preview view in the renderer, despite the current glossary entry.
- Application Settings has five sections: General, Keyboard shortcuts, AI, Publishing, and Data & backups.
- Shared controls already provide semantic labels, visible focus treatment, keyboard-operated tabs and separators, dialog patterns, and non-color diff cues.
- Component tests cover several keyboard and focus behaviors, and `e2e/author-journeys.spec.ts` supplies deterministic local journeys without real provider credentials.
- The product model marks `cross-cutting.accessibility` as implemented. The walkthrough must preserve that capability and report any contradiction as a defect.

## Deliverable

Create `docs/development/guides/accessibility-release-walkthrough.md` with two parts:

1. A reusable setup and checklist.
2. A dated results section recording the environment, each check's result, linked defects, decisions discovered, and domain terms discovered.

Keep evidence in the Markdown report. Add focused screenshots only when they explain a layout failure or a visual cue. Do not capture every passing step.

## Coverage matrix

Run the complete checklist at both required desktop sizes:

| Run | Viewport | Theme |
| --- | --- | --- |
| A | 1440 x 1024 | Light |
| B | 1280 x 800 | Dark |

Then verify that the system theme setting follows a Windows theme change. Record the Windows and Chromium versions used.

At each viewport, cover:

- the Article Library Panel, Navigation Rail, Article Header, Article Editor, Article Status Bar, and Editorial Assistant Panel;
- Write, Proposal Review, Revision History, Fact Check, Style Profile, and Translations;
- General, Keyboard shortcuts, AI, Publishing, and Data & backups Settings;
- publishing profile selection and Markdown/plain-text copy controls in the Article Status Bar;
- confirmation and recovery dialogs reachable from these areas;
- populated, empty, stale, loading, recoverable-error, and destructive-confirmation states where the deterministic service can reach them.

For every area, check keyboard-only completion, focus order, visible focus, focus containment and restoration, accessible names and states, reading order, non-color status and diff meaning, and content reachability without unintended clipping or overlap.

## Implementation sequence

### 1. Build the repeatable state

Reuse the Playwright end-to-end service and its deterministic provider responses. Extend its seed or response behavior only when a checklist state cannot be reached through the existing author journeys. Do not use a real API key or provider call.

List the exact setup actions in the guide so another reviewer can reproduce the same Articles, Revisions, Proposal, Findings, Style Profile state, translation, publishing profile, and Settings state.

### 2. Write the checklist before executing it

Give each check a stable identifier and an expected observable result. Organize checks by application area, then record both viewport results beside the same check. Include generic screen-reader checkpoints for roles, names, states, announcements, dialog behavior, and reading order, but do not claim that a specific screen reader passed.

Do not add Axe, accessibility snapshots, or another broad scanning dependency. [Issue #137](https://github.com/kirillta/skladno/issues/137) owns repeatable NVDA or equivalent verification.

### 3. Execute both viewport runs

Use keyboard input for the complete journey. Mouse input may set the viewport or inspect evidence, but it must not complete an interaction under review.

Exercise all listed views and Settings sections at both sizes. Alternate light and dark themes according to the matrix, then perform the separate system-theme check. Record pass, fail, blocked, or not applicable for every check. A blocked check needs a reason and a linked defect.

### 4. Triage findings

Treat a defect as release-blocking when any required journey cannot be completed by keyboard, focus becomes lost or trapped, a control lacks a usable accessible name, status or diff meaning relies only on color, required content is unreachable at either viewport, or a dialog breaks focus containment or restoration.

Fix a blocker in #125 when the correction is narrow and stays inside the issue's accessibility scope. Add the smallest automated regression test that fails without that correction. File a linked issue for non-blockers and for fixes that require broader product or architecture changes.

Rerun the affected manual checks after each fix. Rerun the full viewport journey if the fix changes shared controls, navigation, focus management, or layout.

### 5. Record documentation discoveries

The results must include `Decisions discovered` and `Domain terms discovered` sections, even when the result is `None`.

Record the existing Publishing Preview mismatch under domain terms. Review the implemented publishing controls in #125, but do not add a new Workspace View or edit the glossary as part of this walkthrough. [Issue #138](https://github.com/kirillta/skladno/issues/138) owns the ADR/glossary routing rules and resolution of that mismatch.

### 6. Close the release evidence

Summarize blocking defects, linked follow-ups, fixes made, regression tests added, and any remaining manual verification. #125 is complete only when every checklist item has a recorded result and each blocker is fixed or explicitly tracked.

## Expected files

- `docs/development/guides/accessibility-release-walkthrough.md`
- narrow web implementation and test files only for defects found
- deterministic end-to-end support only when an otherwise unreachable review state requires it
- affected canonical product-model JSON and generated inventory only if a fix changes capability, contract, status, persistence, or user-visible behavior

## Verification

For documentation-only walkthrough results, run:

```powershell
npm run product:check
```

For any source fix, run its narrow regression test followed by:

```powershell
npm run lint
npm run typecheck
npm run product:check
```

If a source fix changes recorded product behavior, also run `npm run product:impact -- <affected paths>`, update the matching canonical product-model area, and regenerate only that area with `npm run product:docs -- <area>`.
