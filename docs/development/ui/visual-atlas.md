# Skladno visual atlas

This atlas maps visual roles to Tailwind utilities and semantic tokens. `packages/web/src/styles.css` owns their values for every theme. Feature code uses the mapped utility or token and does not copy raw colors, shadows, radii, font sizes, or tracking values.

## Typography roles

| Role | Utilities | Use |
| --- | --- | --- |
| Product UI | `font-ui` | Navigation, controls, metadata, headings, panels, dialogs, and status text |
| Article content | `font-editor` | Article editing and article-length reading or review content |
| Article title | `font-ui text-xl leading-7 font-semibold tracking-tight` | Current Article title |
| Article body | `font-editor text-xl leading-8` | Draft text and Article previews |
| Panel title | `font-ui text-base leading-6 font-semibold` | Assistant and Workspace View titles |
| Introductory copy | `font-ui text-base leading-8 text-muted` | Quiet explanatory copy |
| Body | `font-ui text-base leading-6` | Findings, Proposal content, and supporting views |
| Supporting copy | `font-ui text-sm leading-5` | Dialogs, uncertainty, Settings, and transient messages |
| Body label | `font-ui text-sm leading-5 font-medium` | Article titles in the library |
| Control label | `font-ui text-xs leading-5 font-semibold` | Buttons and selected tabs |
| Metadata | `font-ui text-xs leading-4 text-muted` | Revision identifiers, timestamps, counts, and Article details |
| Status copy | `font-ui text-xs leading-5` | Banners, status blocks, and operation progress |
| Overline | `font-ui text-micro tracking-overline font-semibold uppercase` | Group labels and diff labels |
| Compact badge | `font-ui text-badge font-semibold` | Counts where space is fixed |
| Product identity | `font-ui text-base leading-6 font-semibold text-brand` | Skladno wordmark and collapsed `S` |

The application uses only `text-badge`, `text-micro`, `text-xs`, `text-sm`, `text-base`, `text-lg`, and `text-xl`. `text-lg` is reserved for compact decorative identity marks. Use `tracking-overline` only with `text-micro`.

## Text roles

| Meaning | Utility | Rule |
| --- | --- | --- |
| Primary content | `text-ink` | Default headings and readable body copy |
| Secondary content | `text-muted` | Metadata, hints, inactive tabs, and quiet empty states |
| Interactive or selected | `text-brand` | Links, selection, active workflow, and identity |
| Content on dark fills | `text-on-brand` | Brand actions and tooltips |
| Information | `text-info` | Neutral advisory status |
| Success | `text-success` | Saved, accepted, or completed state |
| Warning | `text-warning` | Saving, stale, or uncertain state |
| Danger | `text-danger` | Errors, rejection, removal, or destructive actions |

Opacity-derived text color is reserved for established placeholder treatment. State always has visible text plus an icon, label, pattern, border, or semantic element.

## Surface and interaction roles

| Token | Utility | Use |
| --- | --- | --- |
| `canvas` | `bg-canvas` | Outermost application canvas |
| `surface` | `bg-surface` | Supporting panels and quiet regions |
| `surface-supporting` | `bg-surface-supporting` | Elevated Library, Assistant, and Settings Navigation panels |
| `surface-raised` | `bg-surface-raised` | Writing surface, fields, menus, dialogs, and cards |
| `border` | `border-border` | Default separators and outlines |
| `border-strong` | `border-border-strong` | Stronger structural separation |
| `brand` | `text-brand`, `bg-brand`, `border-brand` | Primary actions, selection, identity, and links |
| `brand-hover` | `bg-brand-hover` | Solid-action hover |
| `brand-soft` | `bg-brand-soft` | Selected navigation and quiet hover |
| `focus` | `outline-focus` | Keyboard focus |

Use each semantic status foreground with its matching `*-soft` background through `Status`, `Banner`, or the relevant control state.

Proposal diffs use `diff-added`, `diff-added-stripe`, `diff-removed`, and `diff-removed-stripe`. Pair them with `ins` or `del` semantics, explicit labels, and structural borders or stripes.

## Application map

| Area | Surface | Primary role | Supporting role |
| --- | --- | --- | --- |
| Article Library Panel | `surface` | Body label | Overline and metadata |
| Article Header | `surface-raised` | Article title | Metadata and control label |
| Workspace Tab Bar | Workspace surface | Control label | Selected `brand` state |
| Article Editor | `surface-raised` | Article body | Metadata |
| Supporting Workspace Views | Workspace surface | Panel title and body | Metadata or status |
| Editorial Assistant Panel | `surface` | Panel title and introductory copy | Body, controls, and status |
| Article Status Bar | Inherited | Metadata | Semantic status |
| Application Settings | `canvas` with `surface-supporting` navigation and `surface-raised` controls | Panel title and supporting copy | Controls and status |
| Dialogs and menus | `surface-raised` | Panel title and body | Controls |

## Adding or changing a role

1. Reuse the role whose hierarchy and reading density match.
2. When none fits, define the semantic value in `styles.css` and its role here before using it.
3. Use the Tailwind token in feature code.
4. Verify WCAG AA contrast, keyboard focus, reduced motion, collapsed panels, and the 1280 x 800 and 1440 x 1024 layouts.
