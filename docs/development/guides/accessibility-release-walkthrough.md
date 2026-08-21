# Accessibility release walkthrough

This reusable checklist covers Application Settings and the Editorial Workspace in the Windows Chromium application. It does not cover Electron packaging, other browsers, or screen-reader certification. Store each execution as a dated result beside this guide. The latest result is [2026-08-21](accessibility-results/2026-08-21.md).

## Repeatable setup

1. Run `npm run test:e2e`. It starts the deterministic local service with `.e2e-data`, uses no API key, and stops its processes when complete.
2. Start a manual Chromium session with the same service settings from `playwright.config.ts`.
3. In Settings, select LinkedIn Post as the default publishing profile and Spanish as a default translation language.
4. Create `Fixture Article`, enter `Original fixture Article.`, and save a Revision.
5. Send `Improve flow`, accept the Proposal, restore the original Author Revision, then send `fact check`.
6. Create and open the Spanish translation.
7. Use `wait` and `provider error` in Editorial Assistant to reach cancelled and recoverable-error states. Open the restore confirmation before confirming it.

Complete each check by keyboard. The mouse may resize the viewport or inspect a cue. Check visible focus, accessible names and states, reading order, text or pattern alternatives to color, dialog containment, cancellation, confirmation, and focus restoration.

Record P, F, B, or N/A. A failure or block needs a reason and linked issue before release.

## Checklist

| ID | Area and expected observable result | A: 1440 x 1024 light | B: 1280 x 800 dark |
| --- | --- | --- | --- |
| WS-01 | Article Library Panel, Navigation Rail, Article Header, Editor, Status Bar, and Editorial Assistant remain reachable in reading order. Panel collapse controls have names and visible focus. |  |  |
| WS-02 | Write supports keyboard editing, save, Draft recovery, and current-save feedback. Content does not clip or overlap a focused control. |  |  |
| WS-03 | Proposal Review exposes labelled decision controls and non-color diff cues. Accepting a Proposal returns focus to Write. |  |  |
| WS-04 | Revision History and preview are keyboard reachable. Restore confirmation contains focus and restores it after cancel or confirmation. |  |  |
| WS-05 | Fact Check exposes Findings, sources, uncertainty, empty, stale, loading, and recoverable-error states with text cues. |  |  |
| WS-06 | Style Profile exposes populated and empty states, named controls, and non-color status. |  |  |
| WS-07 | Translations exposes ready, stale, empty, loading, and editing states. Creating and opening a translation is keyboard-complete. |  |  |
| WS-08 | Article Status Bar exposes publishing profiles and Markdown and plain-text copy with names, feedback, and non-color cues. |  |  |
| WS-09 | Editorial Assistant reaches populated, loading, cancelled, and recoverable-error states. Stop and error feedback remain keyboard reachable. |  |  |
| ST-01 | General Settings supports System, Light, and Dark in logical keyboard order. System follows a Windows appearance change. |  |  |
| ST-02 | Keyboard shortcuts exposes named controls, shortcut state, conflict feedback, and keyboard navigation. |  |  |
| ST-03 | AI Settings exposes named connection and model controls. Confirmation and removal dialogs contain and restore focus. |  |  |
| ST-04 | Publishing Settings exposes advisory profiles and Default translation languages. Copy remains the only publishing action. |  |  |
| ST-05 | Data & backups supports keyboard-complete backup creation, recoverable errors, and manual recovery instructions. |  |  |

## Screen-reader verification

This procedure is manual. Playwright cannot verify spoken output, virtual-cursor order, or interruption behavior. Issue [#137](https://github.com/kirillta/skladno/issues/137) owns repeatable NVDA or equivalent verification.

Use Windows 11, current stable NVDA with default desktop keyboard layout and speech mode Talk, the release Chromium build without extensions, and 100% browser zoom. Record versions and changed settings. Run the deterministic tests before the manual pass.

Use `NVDA+F7` to inspect elements when a landmark, heading, tab, dialog, or control cannot be reached. Use `NVDA+Tab` only to confirm the focused control. Record spoken text when it differs from the expectation.

| ID | Journey and expected spoken or observable result | A | B |
| --- | --- | --- | --- |
| SR-01 | Settings and Workspace landmarks, roles, names, states, announcements, dialogs, and reading order are usable. |  |  |
| SR-02 | Article title and Draft are named textboxes. Saving announces Saved without moving focus. |  |  |
| SR-03 | Workspace Views announce tab names and selected state; arrow keys select the matching panel. |  |  |
| SR-04 | Proposal decisions, Original, and Proposed are distinguishable; acceptance returns focus to Write. |  |  |
| SR-05 | Restore opens a contained dialog, announces its purpose, closes, and restores focus. |  |  |
| SR-06 | Findings announce source and uncertainty; translation controls and the linked Article are reachable. |  |  |
| SR-07 | Status Bar language, guidance, and Copy controls announce names, expanded states, and results. |  |  |
| SR-08 | Stop, cancellation, and provider error feedback remain reachable without rereading the timeline. |  |  |

A failed screen-reader journey blocks the accessibility result until fixed or tracked as a release blocker.
