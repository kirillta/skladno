---
name: skladno-product-inventory
description: Preserve and maintain Skladno's user-visible product capabilities and feature inventories while distinguishing implemented, partial, and deferred work. Use before adding, changing, replacing, or removing a Skladno feature, including architectural hooks, reducers, providers, state machines, persistence boundaries, routes, clients, or shared contracts that serve a user-visible capability. Use especially when a change could regress, replace, hide, or narrow an existing capability outside the detailed Settings and Article Workspace guardrails.
---

# Skladno Product Inventory

Before changing product code, run `npm run product:impact -- <affected paths>` and treat every returned implemented or partial capability as a preservation requirement. The command returns the complete matching canonical records and scenarios; do not also read generated inventories. Read the matching file in `product-model/areas` only when no path matches or broader product behavior is intentionally changing.

Inspect the implementation, contracts, tests, and diff for the matched records. A refactor or redesign does not authorize feature loss. If removal or narrowing was not explicitly requested, stop and ask; if it was, preserve recoverability and update the record rather than hiding or downgrading it.

Update canonical JSON only when capability, status, contract, persistence, or user-visible behavior changes. Then run `npm run product:docs -- <area>` and `npm run product:check`. Generated files in `docs/development/product` are human-facing output and must not be edited or loaded alongside canonical records.

Before handoff, verify matched capabilities still have implementation and evidence, and report any intentional status change. Use `automated` evidence only when its check names the scenario; otherwise use `human-reviewed`.

Settings changes also use `skladno-settings`; Article Workspace UI changes also use `skladno-ui-guardrails`.
