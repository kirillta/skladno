# Article Library Panel and Navigation Rail

Use these decisions for the desktop Article Library Panel.

## Expanded panel

- Keep the panel narrow (`w-52`) and full-height.
- Keep a 72px-equivalent header (`min-h-18`) with the Skladno wordmark, New article, and collapse actions.
- Keep search in its own bordered row. Use a compact control (`min-h-9`, `py-1.5`, `pl-8`, `pr-2`) with a search icon.
- Show `Recent` only when Articles exist. With no Articles, leave the library area blank; the central workspace provides the create call to action.
- Represent each Article with the document icon, title, detail line, and selected-state card.
- Keep the bottom utility area in this order: Style Profile, Settings, then language/local and save-state indicators. Keep captions and icons left-aligned.

## Collapsed Navigation Rail

- Keep the rail at `w-10` with compact horizontal padding.
- Reserve the same `min-h-18` header height as the expanded panel.
- Use `S` in the same UI font, size, weight, and brand color as the expanded `Skladno` wordmark; use it to expand the panel.
- Keep Style Profile and Settings as icon-only controls at the bottom, aligned with the expanded utility rows.
- Keep the save state as an accessible semantic-colored dot at the bottom. Include an accessible name and tooltip/title with the visible save state.
- Keep icon-only controls at least 36px and give every one an accessible label.
