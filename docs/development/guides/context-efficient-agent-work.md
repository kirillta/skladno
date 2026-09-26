# Agent work in a large codebase

Use this guide when discovery spans features or a code change has several steps. Keep the investigation proportional to the request.

1. Search for the requested behavior with `rg`. Identify its production owner, direct callers, and focused tests. For existing behavior or a moved owner, run `npm run product:impact -- <affected paths>`.
2. Read the code needed to explain the affected flow. Start at the owning symbol and follow relevant calls and imports. Read a full file when its structure matters.
3. Make the smallest change that covers the requested behavior and its affected callers. Keep a brief working ledger for longer tasks: goal, confirmed owners, decisions, checks, and remaining work. Create a repository plan only for a durable handoff.
4. Run a focused check for the changed behavior, then the applicable gates in the [testing guide](testing.md). Repeat a broad gate when a relevant edit or failure calls for it.
5. Review the production path against the request. Report checks and any manual verification still needed.

Use `rg` to find current owners and tests rather than relying on a fixed file map. For renderer ownership, consult [ADR-003](../architecture/adr-003-web-feature-oriented-react-architecture.md); for UI changes, consult the [design system](../ui/design-system.md). Keep command output focused on the failing diagnostic or a short success summary.
