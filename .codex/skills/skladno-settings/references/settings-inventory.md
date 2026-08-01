# Skladno Settings inventory

| Section | Setting | Persistence | Status |
|---|---|---|---|
| General | Appearance, locale, date/time, Article and translation language defaults | `app_settings.application-general` | Persisted; language/default application and timestamp rollout incomplete |
| Key bindings | Configurable application shortcuts | `app_settings.application-key-bindings` | Persisted; command dispatch infrastructure is implemented, workspace action wiring is tracked separately |
| AI | OpenAI connections and active connection | `app_settings.application-ai-connections` | Persisted; add/active/test implemented; connection management incomplete |
| AI | Default model and per-operation overrides | `app_settings.application-model-preferences` | Persisted and resolved for later requests |
| AI | Available model list | Server-side OpenAI refresh only | Implemented; not persisted |
| Publishing | Named profiles, limits, default profile | `publishing_profiles` | Not implemented; fixed legacy profile remains |
| Data | Active data directory | Startup configuration | UI incomplete |
| Backups | Destination, schedule, retention | `app_settings.application-backup-policy` | Persisted; validation, snapshots, and retention incomplete |
