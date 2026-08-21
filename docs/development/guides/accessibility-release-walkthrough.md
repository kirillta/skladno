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
| WS-01 | Article Library Panel, Navigation Rail, Article Header, Editor, Status Bar, and Editorial Assistant remain reachable in reading order. Panel collapse controls have names and visible focus. | B, manual run pending | B, manual run pending |
| WS-02 | Write supports keyboard editing, save, draft recovery, and current-save feedback. No content is clipped or overlaps a focused control. | B, manual run pending | B, manual run pending |
| WS-03 | Proposal Review exposes labelled decision controls and non-color diff cues. Accepting a Proposal returns focus to a usable Write control. | B, manual run pending | B, manual run pending |
| WS-04 | Revision History navigation and revision preview are keyboard reachable. Restore confirmation contains focus and returns it to the invoking control after cancel or restore. | B, manual run pending | B, manual run pending |
| WS-05 | Fact Check exposes Findings, source links, uncertainty, empty, stale, loading, and recoverable-error states with text cues. | B, manual run pending | B, manual run pending |
| WS-06 | Style Profile exposes populated and empty states, controls have names, and status does not rely on color. | B, manual run pending | B, manual run pending |
| WS-07 | Translations exposes ready, stale, empty, loading, and editing states. Creating and opening a translation remains keyboard-complete. | B, manual run pending | B, manual run pending |
| WS-08 | Article Status Bar exposes publishing-profile selection plus Markdown and plain-text copy controls with names, status feedback, and a non-color cue. | B, manual run pending | B, manual run pending |
| WS-09 | Editorial Assistant reaches populated, loading, cancelled, and recoverable-error states. Stop request and error feedback remain reachable by keyboard. | B, manual run pending | B, manual run pending |
| ST-01 | General Settings supports theme selection and keyboard focus in logical order. | B, manual run pending | B, manual run pending |
| ST-02 | Keyboard shortcuts exposes named controls, shortcut state, conflict feedback, and keyboard navigation. | B, manual run pending | B, manual run pending |
| ST-03 | AI Settings exposes named connection and model controls. Confirmation and removal dialogs contain and restore focus. | B, manual run pending | B, manual run pending |
| ST-04 | Publishing Settings exposes profile controls and Default translation languages as labelled checkboxes. Destructive profile removal has a recovery path. | B, manual run pending | B, manual run pending |
| ST-05 | Data & backups exposes keyboard-complete backup and restore controls, including confirmation and recoverable-error feedback. | B, manual run pending | B, manual run pending |
| SR-01 | Roles, names, selected or expanded states, status announcements, dialog behavior, and reading order are suitable for a vendor-neutral screen-reader pass. The NVDA procedure below records the human result. | N/A, #137 | N/A, #137 |

## Screen-reader verification

This procedure is intentionally manual. Playwright verifies that the deterministic journeys and their named controls remain available, but it cannot verify spoken output, virtual-cursor reading order, or interruption behavior. Do not replace this procedure with an automated accessibility scan.

### Supported setup

- Windows 11 and current stable NVDA, using the default desktop keyboard layout and speech mode "Talk". Record the NVDA version and any changed setting in the result.
- The release Chromium build, with browser extensions disabled and no screen-reader browser extension enabled.
- The deterministic local service and fixture setup above. Run `npm run test:e2e` first. It must pass before the manual pass starts.
- Test both viewport and theme rows in this guide. Keep the browser at 100% zoom unless the release target requires another zoom level.

Use `NVDA+F7` to inspect the elements list when a landmark, heading, tab, dialog, or control cannot be reached as expected. Use `NVDA+Tab` only to confirm the focused control. Navigate and activate controls with the keyboard. Record the exact spoken text when it differs from the expected result.

### Critical journeys

| ID | Journey and expected spoken or observable result | A | B |
| --- | --- | --- | --- |
| SR-02 | In Settings, Settings is announced as the current area. General, Keyboard shortcuts, AI, Publishing, and Data & backups are named controls. Each selected section exposes its controls in reading order. | B, NVDA unavailable | B, NVDA unavailable |
| SR-03 | Create `Fixture Article`. Article title and Article draft are named textboxes. Saving announces the Saved status without moving focus away from the editing task. | B, NVDA unavailable | B, NVDA unavailable |
| SR-04 | The Workspace Views are a tab list. Write, Proposal Review, Revisions, Fact Check, Style Profile, and Translations announce their tab name and selected state. Arrow keys move between tabs and expose the matching panel. | B, NVDA unavailable | B, NVDA unavailable |
| SR-05 | Send `Improve flow`, then review and accept the Proposal. Decision controls have usable names. Original and Proposed remain distinguishable in reading order, and acceptance returns focus to Write. | B, NVDA unavailable | B, NVDA unavailable |
| SR-06 | Restore the Author Revision. The confirmation opens as a dialog, keeps focus inside, announces its purpose, closes with Escape or Cancel, and restores focus to the invoking control. | B, NVDA unavailable | B, NVDA unavailable |
| SR-07 | Run `fact check`, then create and edit the Spanish translation. Findings announce source and uncertainty text. Translation controls are named and the translated Article is reachable. | B, NVDA unavailable | B, NVDA unavailable |
| SR-08 | In the Article Status Bar, the source-language, character-guidance, and Copy options controls have names and expanded states. The menus expose their menu items. Markdown and plain-text copy completion or failure is announced. | B, NVDA unavailable | B, NVDA unavailable |
| SR-09 | Send `wait`, stop the request, then send `provider error`. Stop request, cancelled state, and error feedback remain reachable and are announced without reading the entire assistant timeline again. | B, NVDA unavailable | B, NVDA unavailable |

Record P, F, B, or N/A in each cell. A blocked cell states why. A failed cell links a defect. Any failure in SR-02 through SR-09 blocks the accessibility release result until it is fixed or tracked as a release blocker.

## Results, 2026-08-21

### Environment

- Windows 11 Pro, version 10.0.26200, build 26200.
- Playwright 1.62.1 with its installed Chromium 151.0.7922.34 build.
- Skladno revision `0605f39`.
- Deterministic local service and `.e2e-data`; no provider credentials or provider calls.

### Evidence and result

The deterministic author journeys passed in the local Chromium run: 5 passed. Two keyboard-driven runs open every Settings section at 1440 x 1024 light and 1280 x 800 dark, and assert that the page has no horizontal overflow. The other three cover configured translation languages, Article creation, Proposal acceptance, Revision restoration, Findings, translation editing, persisted theme, cancellation, and recoverable provider failure. The focused Settings, shared primitive, workspace tab, restore-dialog, and Workspace suites also passed: 46 tests in 5 files.

This automated coverage supports, but does not replace, the manual A/B walkthrough. The system-theme follow check is blocked until a Windows theme change is observed on the release host.

`npm run test:e2e` passed on 2026-08-21 with 3 deterministic author journeys. NVDA was not installed on this release host, so SR-02 through SR-09 are recorded as blocked rather than inferred from browser automation. The vendor-neutral SR-01 checkpoint remains valid.

### Blocking defects

No application defect was found in the deterministic run. The A/B manual walkthrough, Windows system-theme check, and screen-reader release result are blocked until completed on the supported release host.

### Linked follow-ups

- [#137](https://github.com/kirillta/skladno/issues/137): repeatable NVDA or equivalent screen-reader verification.

### Decisions discovered

See [accessibility review routing](accessibility-review-routing.md). This finding does not require an ADR: it corrects terminology and does not change a lasting architecture boundary.

### Domain terms discovered

The glossary now uses `Publishing copy` for the Article Status Bar's explicit Markdown and plain-text copy controls. `Publishing Preview` was retired because the renderer has no such Workspace View. See [accessibility review routing](accessibility-review-routing.md).

### Remaining manual verification

On the release Windows machine, repeat the system-theme switch and complete the screen-reader procedure tracked by #137. Record any different result as a defect and rerun the affected row after its fix.
