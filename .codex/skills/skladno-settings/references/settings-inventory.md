# Skladno Settings inventory

| Section | Setting | Persistence | Status |
|---|---|---|---|
| General | Appearance, locale, date/time/time-zone, Article and translation language defaults | `app_settings.application-general` | Persisted; General Settings supports device-local or explicit IANA time zones, device-local date and time formatting (including Windows regional patterns), and explicit `DD.MM.YYYY`, `DD/MM/YYYY`, `MM/DD/YYYY`, `YYYY-MM-DD`, 12-hour, and 24-hour preferences. Its timestamp preview and Revision History honor the saved preference. Relative Article Library activity remains intentionally time-zone independent. |
| Key bindings | Configurable application shortcuts | `app_settings.application-key-bindings` | Persisted; command dispatch infrastructure is implemented, workspace action wiring is tracked separately |
| AI | OpenAI connections and active connection | `app_settings.application-ai-connections` | Persisted; add, duplicate prevention, active selection, test, and confirmed deletion are implemented. |
| AI | Default model and per-skill overrides | `app_settings.application-model-preferences` | Persisted for six built-in skills; legacy operation overrides normalize on read without exposing unknown keys. |
| AI | Available model list | Server-side OpenAI refresh only | Implemented; not persisted |
| Publishing | Fixed built-in profiles and persisted default for new Articles | `app_settings.publish-limit-profile` | Partial; Article-specific selection is implemented, while custom profile management remains deferred. |
| Data | Active data directory | Startup configuration | UI incomplete |
| Backups | Destination, schedule, retention | `app_settings.application-backup-policy` | Persisted; validation, snapshots, and retention incomplete |
