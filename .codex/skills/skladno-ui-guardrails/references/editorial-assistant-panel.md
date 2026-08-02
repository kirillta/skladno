# Editorial Assistant Panel

Use these decisions for the desktop Editorial Assistant Panel and its collapsed form.

## Panel foundation

- Treat the Editorial Assistant Panel as the counterpart to the Article Library Panel. Use the same supporting `bg-surface` background in expanded and collapsed states.
- Keep form controls and menus on `bg-surface-raised` so they remain legible as raised interactive elements.
- Align the Assistant header to the Article Library header: use `min-h-18`, a `text-base font-semibold` identity title, inline SVG iconography, and a 36px collapse control.
- Do not make the Assistant title larger or use a different font treatment than the Article Library identity.
- Keep the idle conversation area quiet. Place its author-centered explanation at the top and preserve open space for future editorial activity; do not fill it with permanently visible operation controls.

## Stages and composer

- Place the composer in a fixed footer.
- Reserve textarea space for an inline paper-plane Send icon at the lower right. Give the icon-only Send control an accessible name and never let it cover entered text.
- Select the advisory workflow through one **Stages** dropdown button immediately above the composer.
- Open Stages as a compact floating menu upward so it does not reflow or resize the composer. Do not use a permanently expanded grid, a collapsible in-flow button stack, or a native select.
- Make a Stage update Article metadata and select its aligned pending operation without sending the request. Keep the current Stage visible in the Stages button.
- Enable Send only after the author supplies guidance and selects an operation. Disable Send while streaming.
- Send the selected operation with the current guidance. For translation, also send the current target language.

## Shared state and safety

- Keep the target-language selector in the Article Header alongside article-level controls, not in the Assistant Panel. The advisory workflow selector belongs in the Editorial Assistant Panel.
- Store the target language in shared workspace state so translation requests use the language selected in the header.
- Keep generated output and request status in the conversation area distinct from the Article.
- Preserve explicit approval for proposals and retain clear streaming, error, and cancellation controls.
