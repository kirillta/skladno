# Skladno Settings inventory

| Section | Setting | Persistence | Status |
|---|---|---|---|
| General | Appearance, locale, date/time/time-zone, Article and translation language defaults | `app_settings.application-general` | Persisted; General Settings supports device-local or explicit IANA time zones and its timestamp preview honors the saved preference. Revision History honors the saved locale and date/time preferences, while time-zone and timestamp rollout in workspace surfaces remains incomplete. |
| Key bindings | Configurable application shortcuts | `app_settings.application-key-bindings` | Persisted; command dispatch infrastructure is implemented, workspace action wiring is tracked separately |
| AI | OpenAI connections and active connection | `app_settings.application-ai-connections` | Persisted; add/active/test implemented; connection management incomplete |
| AI | Default model and per-operation overrides | `app_settings.application-model-preferences` | Persisted and resolved for later requests |
| AI | Available model list | Server-side OpenAI refresh only | Implemented; not persisted |
| Publishing | Fixed built-in profiles and persisted default for new Articles | `app_settings.publish-limit-profile` | Partial; Article-specific selection is implemented, while custom profile management remains deferred. |
| Data | Active data directory | Startup configuration | UI incomplete |
| Backups | Destination, schedule, retention | `app_settings.application-backup-policy` | Persisted; validation, snapshots, and retention incomplete |
