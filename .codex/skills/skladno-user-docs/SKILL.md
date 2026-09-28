---
name: skladno-user-docs
description: Write or revise Skladno user documentation, including help articles, setup guides, and feature explanations. Use when changing content in site/user-docs or other Author-facing instructions.
---

# Skladno user documentation

Write for Authors using the current application. Check the relevant screen's rendered controls and `packages/web/src/i18n/messages.ts` before naming a setting, action, view, or status. Use the exact English interface label in headings, steps, and cross-references. If the interface differs from the documentation, verify current behavior before choosing wording; do not invent a friendlier label and present it as a second product name.

Use [the glossary](../../../site/user-docs/glossary.md) for domain terms and the implementation or product model for behavior. Describe only available behavior, including prerequisites, fallback behavior, and limits that affect the Author's decision. Explain what to do in the app, not its internal architecture.

Give each entity one name throughout an article. Repeat the same term when clarity needs it; do not alternate synonyms or pair two names for one entity. A heading about the **App model** setting should call it **App model**, matching the control, rather than renaming it “Text generation model for Skladno.” Distinguish genuinely different entities, such as the App model and the Default model.

Before finishing, read the article from the Author's perspective: can every named control be found, does each term mean one thing, and do the steps match the current app? Fix related links and references when a label changes.
