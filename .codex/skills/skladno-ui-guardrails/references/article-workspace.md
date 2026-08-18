# Article Workspace

- Keep the desktop workspace at viewport height. Scroll designated internal regions, not the page shell.
- Keep the Article Status Bar visible as a fixed 24px row.
- Keep the white writing surface constrained within the tinted workspace canvas. The Workspace View owns its quiet scrollbar.
- Preserve alignment across expanded and collapsed panels, including header and footer heights.
- Use sentence case for controls. Use real UI icons with accessible labels.
- Keep empty areas quiet and empty-state titles regular-weight and muted.
- Use `w-full max-w-[calc(100vw-2rem)] sm:max-w-3xl` for focused dialogs unless the task requires another width.
- Route actions through existing application state; do not leave dead controls.
