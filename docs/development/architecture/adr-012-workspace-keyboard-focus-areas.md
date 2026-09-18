# ADR-012: Workspace keyboard navigation uses focus areas

- Status: Accepted
- Date: 2026-09-18
- Scope: Workspace and Settings keyboard focus
- Depends on: [ADR-003](adr-003-web-feature-oriented-react-architecture.md)

## Context

The Workspace has many independent controls. A control-by-control Tab sequence makes returning to the Article editor or Assistant composer slow and unpredictable. It also competes with established keyboard behavior in text editors, menus, tab lists, toolbars, and dialogs.

## Decision

Tab and Shift+Tab move between visible Workspace focus areas in this order:

1. Library
2. Article header
3. Workspace views
4. Formatting toolbar
5. Article editor
6. Article status
7. Assistant chat
8. Assistant composer

Entering an area focuses its stable entry target, otherwise its last valid focused descendant. Missing, disabled, collapsed, or hidden entries leave the sequence. The editor retains its caret or selection when Lexical can restore it.

Settings remains separate from the Workspace. Its two areas are Settings navigation and Settings content.

Areas keep their existing local keyboard rules. Library uses Up and Down outside Search. Article Header and Article Status use Left and Right. Workspace Views, menus, and the formatting toolbar keep their current roving behavior. The editor, composer, and Search retain native text-editing keys. Assistant chat keeps Up and Down for scrolling and uses Left and Right for actionable results. Dialogs own focus while open.

`packages/web/src/ui/focus-area-navigation.ts` owns traversal and restoration. Workspace and Settings mark stable area roots and entry targets; it does not replace feature-owned keyboard handlers or introduce a global focus store.

## Consequences

Keyboard Authors can move between major work areas without traversing every control, while each feature keeps its conventional keyboard interaction. A new focusable Workspace control belongs to an existing area or an explicit popup or dialog.

## Verification

Focused web tests cover forward and reverse traversal, hidden entries, restored targets, Settings separation, Assistant action navigation, Library and Status control navigation, and Article Header navigation. Run affected web tests, `npm run typecheck`, and `npm run lint`. Complete the keyboard pass in Electron before release.
