# Skladno visual atlas

This atlas is the source of truth for type and color across the web application. It records the visual roles already present in the Editorial Workspace and gives each role one repeatable treatment. Use the named Tailwind utilities and semantic tokens from `styles.css`; do not copy hexadecimal values or create a near-duplicate size in feature code.

## Font families

| Role | Tailwind utility | Stack | Use |
| --- | --- | --- | --- |
| Product UI | `font-ui` | Inter, `ui-sans-serif`, `system-ui`, sans-serif | Navigation, controls, metadata, headings, panels, dialogs, and status text |
| Article content | `font-editor` | Georgia, "Times New Roman", serif | The Article Editor writing surface and article-length reading or review content |

Inter is not downloaded by the application. The stack uses a locally installed Inter when available and otherwise falls back to the operating-system UI font. Do not introduce a third font family.

## Typography roles

Sizes are written as CSS pixels for quick comparison; the implementation remains in `rem`.

| Role | Family | Size / line height | Weight and tracking | Default color | Current examples |
| --- | --- | --- | --- | --- | --- |
| Article title | UI | 20 / 28 | 600, tight | `ink` | Current Article title in the Article Header |
| Article body | Editorial | 20 / 32 | 400 | `ink` | Draft text in the writing surface |
| Panel title | UI | 16 / 24 | 600 | `ink` | Editorial Assistant and workspace-view titles |
| Introductory copy | UI | 16 / 32 | 400 | `muted` | Quiet explanatory copy in the assistant panel |
| Body | UI | 16 / 24 | 400 | `ink` | Findings, proposal content, and supporting workspace views |
| Supporting copy | UI | 14 / 20 | 400 | `ink` or `muted` | Dialog explanations, uncertainty, settings, and transient messages |
| Body label | UI | 14 / 20 | 500 | `ink` or inherited interactive color | Article titles in the Article library |
| Control label | UI | 12 / 20 | 600 | Variant-controlled | Buttons and selected tabs |
| Metadata | UI | 12 / 16 | 400 | `muted` | Revision IDs, timestamps, character counts, and Article details |
| Status copy | UI | 12 / 20 | 400, with a strong label when needed | Semantic status foreground | Banners, status blocks, and operation progress |
| Overline | UI | 10.4 / 16 | 600, uppercase, `0.08em` tracking | `muted` or semantic status foreground | Article-list group labels and diff labels |
| Compact badge | UI | 10 / 10 | 600 | `on-brand` or `brand` | Count badges with very limited space |
| Product identity | UI | 16 / 24 | 600 | `brand` | Skladno wordmark and collapsed `S`; the decorative mark may use 18 / 18 |

The implementation scale is deliberately small:

- `text-badge`: 10px with a unit line height, only for compact badges.
- `text-micro`: 10.4px / 16px, only for overlines and dense utility metadata.
- `text-xs`: 12px, for controls, status, and metadata.
- `text-sm`: 14px, for supporting and dense UI copy.
- `text-base`: 16px, for standard body copy, panel titles, and intentionally spacious introductory copy.
- `text-lg`: 18px, only for a compact decorative identity mark.
- `text-xl`: 20px, for the Article title and Article content.

Do not use arbitrary square-bracket font-size or letter-spacing utilities. Use `tracking-overline` with `text-micro`. Color does not communicate state by itself: status and diff treatments also need an icon, label, pattern, or border style.

## Text color roles

| Meaning | Tailwind utility | Token | Rule |
| --- | --- | --- | --- |
| Primary content | `text-ink` | `--color-ink` | Default headings and readable body copy |
| Secondary content | `text-muted` | `--color-muted` | Metadata, hints, inactive tabs, and quiet empty states |
| Interactive or selected | `text-brand` | `--color-brand` | Links, selected navigation, active workflow, and brand identity |
| On solid dark color | `text-on-brand` | `--color-on-brand` | Text on brand fills and dark tooltips |
| Informational status | `text-info` | `--color-info` | Neutral advisory status |
| Successful status | `text-success` | `--color-success` | Saved, accepted, or successful state |
| Cautionary status | `text-warning` | `--color-warning` | Saving, stale, or uncertain state |
| Destructive or failed status | `text-danger` | `--color-danger` | Errors, deletion, rejection, or failed state |

Avoid opacity-derived text colors except for placeholders, where `text-ink/45` is the established treatment. Interactive controls inherit their text color from the primitive variant.

## Color atlas

### Surfaces and structure

| Token | Hex | Tailwind | Use |
| --- | --- | --- | --- |
| `canvas` | `#fbfaf8` | `bg-canvas` | Outermost application canvas |
| `surface` | `#f4f2ee` | `bg-surface` | Supporting panels and quiet workspace regions |
| `surface-supporting` | `#ebe8e2` | `bg-surface-supporting` | Elevated supporting panels: Article Library Panel, Editorial Assistant Panel, and Settings Navigation |
| `surface-raised` | `#ffffff` | `bg-surface-raised` | Writing surface, fields, menus, dialogs, and raised cards |
| `border` | `#e7e4de` | `border-border` | Default separators and component outlines |
| `border-strong` | `#c7c3ba` | `border-border-strong` | Stronger separation when the default border is insufficient |
| `ink` | `#30302d` | `text-ink`, `bg-ink` | Primary text and dark tooltip surface |
| `muted` | `#706f69` | `text-muted` | Secondary text and inactive content; passes AA on `surface` |
| `on-brand` | `#ffffff` | `text-on-brand` | Content on brand or ink fills |

### Brand and interaction

| Token | Hex | Tailwind | Use |
| --- | --- | --- | --- |
| `brand` | `#28777a` | `text-brand`, `bg-brand`, `border-brand` | Primary action, selection, identity, and links |
| `brand-hover` | `#1f6265` | `bg-brand-hover` | Hover for solid brand actions |
| `brand-soft` | `#e4f1f0` | `bg-brand-soft` | Selected navigation and quiet interactive hover |
| `focus` | `#28777a` | `outline-focus` | Universal keyboard focus indicator |

### Semantic status

| Family | Foreground | Soft background | Meaning |
| --- | --- | --- | --- |
| Info | `info` — `#245876` | `info-soft` — `#dcecf3` | Advisory or neutral status |
| Success | `success` — `#1f6549` | `success-soft` — `#dceee3` | Completed, saved, or accepted |
| Warning | `warning` — `#795108` | `warning-soft` — `#f7ead0` | Caution, saving, outdated, or uncertain |
| Danger | `danger` — `#9b2c23` | `danger-soft` — `#f8e1dd` | Error, conflict, removal, or destructive action |

Use the foreground and soft background as a pair. Every status also needs visible text and a non-color cue from `Status`, `Banner`, or the relevant control state.

### Proposal diffs

| Token | Hex | Use |
| --- | --- | --- |
| `diff-added` | `#dcefe2` | Base background for proposed additions |
| `diff-added-stripe` | `#e9f5ed` | Alternating addition stripe |
| `diff-removed` | `#f7dfdb` | Base background for removed text |
| `diff-removed-stripe` | `#fce9e6` | Alternating removal stripe |

Diff color is always paired with `ins`/`del` semantics, an Added/Removed or Proposed/Original label, and a stripe or structural border.

## Application map

| Area | Surface | Primary type | Supporting type | Accent |
| --- | --- | --- | --- | --- |
| Article Library Panel | `surface` | Body label | Overline and metadata | `brand` for selection and identity |
| Article Header | `surface-raised` | Article title | Metadata and control label | `brand` for the active workflow stage |
| Workspace Tab Bar | Inherited workspace surface | Control label | — | `brand` for the selected view |
| Article Editor | `surface-raised` | Article body | Metadata | `brand` only for actions and focus |
| Supporting workspace views | Inherited workspace surface | Panel title and body | Metadata or status copy | Semantic status colors as needed |
| Editorial Assistant Panel | `surface` | Panel title and introductory copy | Body, control label, and status copy | `brand` for the assistant mark and actions |
| Article Status Bar | Inherited surface | Metadata | — | Semantic save-state foreground |
| Dialogs and menus | `surface-raised` | Panel title and body | Control label | Variant-controlled |

## Adding or changing a visual role

1. Reuse an existing role whenever its hierarchy and reading density match.
2. If no role fits, define a semantic token in `styles.css` and document it here before using it.
3. Use the token through Tailwind; never paste a raw color, shadow, radius, arbitrary font size, or tracking value into feature code.
4. Check WCAG AA contrast, keyboard focus, reduced motion, collapsed panels, and the 1280 × 800 and 1440 × 1024 desktop layouts.
