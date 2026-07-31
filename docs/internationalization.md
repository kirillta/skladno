# Internationalization

Skladno ships one complete interface locale, English (`en`). Application-owned renderer copy lives in `packages/web/src/i18n/messages.ts`; semantic IDs are stable and grouped by responsibility. `locales/en.ts` must contain exactly that inventory.

Use ICU messages for interpolation and count-dependent wording. Parameters are named data such as `{articleTitle}` and `{count}`; never concatenate translated fragments or treat author input as ICU source. Use `intl.formatNumber`/`FormattedNumber` for displayed numbers and `formatDateTime` for timestamps so General date and time preferences stay consistent.

Accessible-only names have their own IDs. Do not translate Article text, proposals, findings, citations, user-entered names, model IDs, environment-variable names, paths, URLs, Markdown, or persisted enum values.

The local service sends stable `ApplicationErrorCode` payloads only. The renderer maps them in `i18n/errors.ts`; payload parameters must be safe presentation data and never include credentials, article bodies, provider output, paths, or stack traces.

## Adding a locale

Open a locale-specific issue naming the language and human reviewer. Copy the canonical inventory, translate every entry while preserving ICU arguments and rich-text placeholders, add metadata, and validate catalog completeness and ICU syntax. Run type, lint, catalog, and component tests; obtain native-language review before extending the installed registry and shared locale union. Review terminology, responsive clipping, keyboard access, accessible names, plural cases, dates/numbers, and English fallback behavior.
