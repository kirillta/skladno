---
name: refactoring
description: Apply Skladno's code structure, cognitive complexity, file naming, and export rules when writing, modifying, reviewing, or planning code in this repository. Use for behavior-preserving refactoring and to prevent structural violations in new code.
---

# Refactoring

Apply these rules within the requested scope. A review or plan does not authorize edits, and a local change does not authorize repository-wide cleanup. Follow the repository's AGENTS.md and affected architecture references before choosing an extraction boundary.

## Structure rules

- Keep each function and method within one semantic responsibility. Extract work that crosses a responsibility boundary into a focused function or, within a class, usually a private method. An orchestration method may sequence named operations while each operation owns its implementation.
- Keep cognitive complexity strictly below 10 for every function and method, including callbacks: the maximum is 9. Flatten nesting and extract meaningful responsibilities. Cognitive complexity is not cyclomatic complexity or line count; splitting arbitrary code fragments just to lower a score does not satisfy the responsibility rule.
- Group interface, class, and other exported-entity properties by meaning. Split unrelated responsibilities instead of growing a god object or hiding unrelated properties inside a generic options object.
- Use explicit control flow or intermediate variables instead of nested ternaries. A ternary expression may contain only one conditional level.
- Prefer robust solutions that remain understandable as the code evolves. Reuse an existing helper or native facility when it fits the responsibility; introduce abstractions only for a demonstrated need.

## File names and exports

- Keep source files under 300 lines where practical and always below 350 lines, counting blank lines and comments. Split larger files along meaningful responsibility boundaries; do not compress formatting to meet the limit.
- Every file name must meaningfully identify its responsibility or principal declaration, using the repository's naming convention. Prefer domain-specific names such as `article-revision-store.ts` over vague names such as `helpers.ts`, `misc.ts`, or `manager.ts`. Required framework and tool filenames retain their required names.
- Each source file has at most one major exported entry, such as a class, interface, type, or component. Separate independently meaningful exported declarations into appropriately named files. Private implementation helpers may remain beside their only caller.
- Cohesive standalone functions may share a file. This exception does not permit an unrelated utility collection or multiple major classes or interfaces in the same file.
- `packages/shared` is exempt from the one-major-export rule: related shared contract and synchronous primitive declarations may remain grouped. Preserve its feature organization and public exports. The naming, responsibility, and complexity rules still apply.
- Re-export-only entry points may preserve the existing public API. They do not own multiple implementations.

## Workflow and verification

1. Locate the affected declarations, all direct callers, and existing focused tests. Identify the violated rule and the behavior to preserve. Follow repository product-impact requirements before moving behavior owners.
2. Make the smallest change that satisfies the rules and preserves the applicable architecture. Update imports and callers when moving or renaming files. Keep unrelated work outside the diff.
3. Check every added or changed function, file name, file line count, and export against the rules. Use an available cognitive-complexity analyzer when configured; otherwise review nesting and control flow manually and disclose that the limit was not tool-verified. Never present a cyclomatic-complexity check as evidence for this limit.
4. Run the repository's required checks and focused behavior tests. Verify behavior through existing callers rather than adding a test for every extracted helper. Report checks run, unresolved violations, and any remaining manual verification.
