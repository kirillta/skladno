---
name: skladno-settings
description: Implement, review, or repair Skladno Application Settings, including settings UI, local-service routes, persistence, OpenAI configuration, publishing profiles, backups, autosave, and accessibility. Use whenever changing Settings sections or their contracts.
---

# Skladno Settings

Follow `skladno-product-inventory`: run `npm run product:impact -- <affected paths>` and load `product-model/areas/settings.json` only when routing is insufficient. Do not read the generated inventory.

Keep Settings a separate application screen. Give each control a visible label, persistent hint connected with `aria-describedby`, and save or validation status. Retain invalid local input with recovery guidance.

Keep secrets server-side: store and return only environment-variable names, never values. Persist valid changes through the existing focused settings boundary.

Inspect the affected client, contract, route, persistence, tests, and diff. Run focused tests, typecheck, and lint; update the model and run product docs/check only when behavior or its contract changed.
