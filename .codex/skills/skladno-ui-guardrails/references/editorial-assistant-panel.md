# Editorial Assistant Panel

Use these decisions for the desktop Editorial Assistant Panel and its collapsed form.

## Panel foundation

- Treat the Editorial Assistant Panel as the counterpart to the Article Library Panel. Use the same supporting `bg-surface` background in expanded and collapsed states.
- Keep form controls and menus on `bg-surface-raised` so they remain legible as raised interactive elements.
- Align the Assistant header to the Article Library header: use `min-h-18`, a `text-base font-semibold` identity title, inline SVG iconography, and a 36px collapse control.
- Do not make the Assistant title larger or use a different font treatment than the Article Library identity.
- Keep the idle conversation area quiet. Place its author-centered explanation at the top and preserve open space for future editorial activity; do not fill it with permanently visible operation controls.

## Skills and composer

- Place the composer in a fixed footer.
- Reserve textarea space for an inline paper-plane Send icon at the lower right. Give the icon-only Send control an accessible name and never let it cover entered text.
- Offer optional built-in skills through one **Quick actions** dropdown button immediately above the composer. Open it upward without reflowing the composer.
- Quick actions and `/` insert one structured skill tag at the composer caret. The visible tag can be removed without deleting the author’s remaining message.
- Send is the sole request trigger. It is enabled for a non-empty author message, with or without a skill tag, and disabled while streaming.
- A non-empty Article Editor selection becomes the active request scope. Show a removable `Article selection` chip and only offer selection-compatible skills.

## Shared state and safety

- Use the default translation languages from General Settings. Translation requests may target every configured language other than the current Article language; completed targets are selected in the Translations View.
- Keep generated output and request status in the conversation area distinct from the Article.
- Preserve explicit approval for proposals and retain clear streaming, error, and cancellation controls.
