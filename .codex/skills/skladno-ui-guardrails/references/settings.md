# Settings

- Keep Settings a separate application screen with desktop navigation, a mobile section selector, and a labeled back action.
- Build sections with `SettingsGroup`, `SettingRow`, and shared controls. Keep groups open; use disclosures only for advanced or conditional choices.
- Give every control a visible label, a persistent hint connected with `aria-describedby`, and save or validation status. Retain invalid local input with recovery guidance.
- Use native control semantics, including `switch` for binary settings and `aria-expanded` with `aria-controls` for disclosures.
- Keep configured items compact. Show active state and actions with text, not color alone.
