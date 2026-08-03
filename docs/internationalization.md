# Internationalization

Skladno ships one complete interface locale, English (`en`). Application-owned renderer copy lives in `packages/web/src/i18n/messages.ts`; semantic IDs are stable and grouped by responsibility. `locales/en.ts` must contain exactly that inventory.

Use ICU messages for interpolation and count-dependent wording. Parameters are named data such as `{articleTitle}` and `{count}`; never concatenate translated fragments or treat author input as ICU source. Use `intl.formatNumber`/`FormattedNumber` for displayed numbers and `formatDateTime` for timestamps so General date and time preferences stay consistent.

Accessible-only names have their own IDs. Do not translate Article text, proposals, findings, citations, user-entered names, model IDs, environment-variable names, paths, URLs, Markdown, or persisted enum values.

## Enforcement

Production components consume the application-level `I18nProvider`; fixed-locale or component-local providers are test-only. ESLint rejects uncatalogued JSX copy and literal user-visible attributes, production `IntlProvider` instances, and selectors coupled to localized accessible labels. Intentional product identity text uses the narrow repository allowlist; other exceptions require a local suppression with a reason.

React Intl message IDs are typed from the canonical catalog. Prefer explicit `Record<DomainValue, MessageId>` mappings for domain-to-copy boundaries; do not build unchecked IDs from runtime strings. Catalog tests require every installed locale to contain exactly the canonical IDs with valid ICU syntax. A pseudo-locale component test verifies that core workspace surfaces inherit the surrounding provider and exposes hard-coded English or provider shadowing.

Translated text is presentation data, never an identifier, selector, branch condition, enum, transport value, or persisted control value. Use refs or stable data attributes for DOM behavior. A localized default may be stored only when it becomes author-editable Article content or metadata at creation; after persistence it is Article data and is not translated again.

The local service sends stable `ApplicationErrorCode` payloads only. The renderer maps them in `i18n/errors.ts`; payload parameters must be safe presentation data and never include credentials, article bodies, provider output, paths, or stack traces.

## Adding a locale

Open a locale-specific issue naming the language and human reviewer. Copy the canonical inventory, translate every entry while preserving ICU arguments and rich-text placeholders, add metadata, and validate catalog completeness and ICU syntax. Run type, lint, catalog, pseudo-locale, and component tests; obtain native-language review before extending the installed registry and shared locale union. Review terminology, responsive clipping, keyboard access, accessible names, plural cases, dates/numbers, and English fallback behavior.
