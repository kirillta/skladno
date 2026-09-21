---
name: plans-and-delegation
description: Create executable Skladno plans and coordinate their implementation. Use when creating or revising a plan, implementing a plan or incremental work, or delegating tasks in this repository.
---

# Plans and delegation

Assume plans will almost always be executed by a less capable model. Write executable plans, not aspirational outlines: ground each step in the current codebase, name the affected files or symbols, specify the concrete change and dependencies, and give verification commands with expected results. Resolve design decisions during planning and make required context explicit so the executing model can proceed without reconstructing your reasoning.

When planning or implementing incrementally, make each step self-contained within its business scope. Split work by business task or capability, and include all applicable application conventions in every step: i18n, exception handling, tracing and diagnostics, validation, accessibility, and required verification. A step is complete only when its behavior and these conventions are implemented together; never skip them or defer them to a later cleanup step.

When creating a plan, assess complexity, dependencies, and opportunities for independent work. Record `solo` or `delegated` execution with a brief reason. Delegate only when parallel work is likely to save time or improve quality; complexity alone does not require subagents.

For delegated work, use a short Markdown table recording each task's scope, owner, owned files or areas, dependencies, deliverable and verification, model, and reasoning level. Keep tightly coupled work with one owner and sequence edits to shared files.

When asked to implement a plan, check these assignments against the current codebase, add missing metadata, and refresh stale assignments. Then launch eligible subagents according to the metadata without asking for confirmation again, respecting dependencies and available concurrency. If subagents are unavailable, proceed sequentially and report the limitation. Planning alone does not authorize implementation.

Use these model defaults unless the user specifies otherwise:

| Role or task | Model | Reasoning |
| --- | --- | --- |
| Main agent and general coding | `gpt-5.6-terra` | Medium |
| Small, well-defined one-shots and repetitive work | `gpt-5.6-luna` | Medium |
| Complex investigation, debugging, and difficult implementation | `gpt-5.6-sol` | Low |

Terra Medium is the preferred main-session configuration; these instructions do not switch an already-running session's model. Apply the defaults when selecting subagents. The main agent coordinates assignments, integrates results, and owns final verification.
