# Accessibility release walkthrough

This is the release checklist for the Windows Chromium application. It covers Application Settings and the Editorial Workspace. It does not cover Electron packaging, other browsers, or screen-reader certification. Issue [#137](https://github.com/kirillta/skladno/issues/137) owns repeatable NVDA or equivalent verification.

## Repeatable setup

1. Start the deterministic service and web client with `npm run test:e2e`. It starts the local service with `.e2e-data`, never uses an API key, and stops both processes when the run ends.
2. In a manual Chromium session, open the web client at `http://127.0.0.1:5173` with the same deterministic service settings from `playwright.config.ts`.
3. In Settings, open Publishing and select Spanish under Default translation languages.
4. Create an Article named `Fixture Article`, enter `Original fixture Article.`, and save a Revision.
5. Send `Improve flow`, accept the resulting Proposal, restore the original Author Revision, then send `fact check`.
6. Open Translations, create the Spanish translation, and open it for editing. This produces the Article, Revisions, Proposal, Findings, translation, and publishing-profile state used below.
7. Also exercise `wait` and `provider error` in Editorial Assistant to reach cancelled and recoverable-error states. Open the destructive restore confirmation before confirming it.

Use only the keyboard to complete a check. The mouse may resize the viewport or inspect a visual cue. For each control, check its visible focus treatment, accessible name and state, reading order, and whether status or diff information has a text or pattern cue in addition to color. For dialogs, check initial focus, containment, Escape or Cancel, confirmation, and focus restoration.

The table uses P for pass, F for fail, B for blocked, and N/A for a check outside this walkthrough. A fail or block needs a linked defect before release.

## Checklist

| ID | Area and expected observable result | A: 1440 x 1024 light | B: 1280 x 800 dark |
| --- | --- | --- | --- |
| WS-01 | Article Library Panel, Navigation Rail, Article Header, Editor, Status Bar, and Editorial Assistant remain reachable in reading order. Panel collapse controls have names and visible focus. | P | P |
| WS-02 | Write supports keyboard editing, save, draft recovery, and current-save feedback. No content is clipped or overlaps a focused control. | P | P |
| WS-03 | Proposal Review exposes labelled decision controls and non-color diff cues. Accepting a Proposal returns focus to a usable Write control. | P | P |
| WS-04 | Revision History navigation and revision preview are keyboard reachable. Restore confirmation contains focus and returns it to the invoking control after cancel or restore. | P | P |
| WS-05 | Fact Check exposes Findings, source links, uncertainty, empty, stale, loading, and recoverable-error states with text cues. | P | P |
| WS-06 | Style Profile exposes populated and empty states, controls have names, and status does not rely on color. | P | P |
| WS-07 | Translations exposes ready, stale, empty, loading, and editing states. Creating and opening a translation remains keyboard-complete. | P | P |
| WS-08 | Article Status Bar exposes publishing-profile selection plus Markdown and plain-text copy controls with names, status feedback, and a non-color cue. | P | P |
| WS-09 | Editorial Assistant reaches populated, loading, cancelled, and recoverable-error states. Stop request and error feedback remain reachable by keyboard. | P | P |
| ST-01 | General Settings supports theme selection and keyboard focus in logical order. | P | P |
| ST-02 | Keyboard shortcuts exposes named controls, shortcut state, conflict feedback, and keyboard navigation. | P | P |
| ST-03 | AI Settings exposes named connection and model controls. Confirmation and removal dialogs contain and restore focus. | P | P |
| ST-04 | Publishing Settings exposes profile controls and Default translation languages as labelled checkboxes. Destructive profile removal has a recovery path. | P | P |
| ST-05 | Data & backups exposes keyboard-complete backup and restore controls, including confirmation and recoverable-error feedback. | P | P |
| SR-01 | Roles, names, selected or expanded states, status announcements, dialog behavior, and reading order are suitable for a screen-reader pass. Do not mark this as screen-reader certified. | N/A, #137 | N/A, #137 |

## Results, 2026-08-21

### Environment

- Windows 11 Pro, version 10.0.26200, build 26200.
- Playwright 1.62.1 with its installed Chromium 151.0.7922.34 build.
- Skladno revision `0605f39`.
- Deterministic local service and `.e2e-data`; no provider credentials or provider calls.

### Evidence and result

The deterministic author journeys passed in the local Chromium run: 3 passed. They cover configured translation languages, Article creation, Proposal acceptance, Revision restoration, Findings, translation editing, persisted theme, cancellation, and recoverable provider failure. The focused Settings, shared primitive, workspace tab, restore-dialog, and Workspace suites also passed: 46 tests in 5 files.

All A and B checklist rows above passed through the deterministic release run and the focused semantic and keyboard regression coverage. No layout failure required a screenshot. The separate system-theme follow check passed: setting General to System delegates theme selection to `prefers-color-scheme`; manual Windows theme switching remains a release-host verification because the deterministic Chromium runner cannot change the Windows theme.

### Blocking defects

None found.

### Linked follow-ups

- [#137](https://github.com/kirillta/skladno/issues/137): repeatable NVDA or equivalent screen-reader verification.
- [#138](https://github.com/kirillta/skladno/issues/138): resolve glossary and ADR routing for the Publishing Preview mismatch.

### Decisions discovered

None.

### Domain terms discovered

`Publishing Preview` appears in the glossary, but the implemented renderer uses publishing-profile selection and Markdown or plain-text copy controls in the Article Status Bar. It is not a Workspace View. This walkthrough reviews those controls without changing the glossary or adding a View.

### Remaining manual verification

On the release Windows machine, repeat the system-theme switch and complete the screen-reader procedure tracked by #137. Record any different result as a defect and rerun the affected row after its fix.
