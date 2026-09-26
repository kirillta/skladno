---
name: plans-and-delegation
description: Create or implement durable Skladno plans, or coordinate explicitly requested agent delegation.
---

# Plans and delegation

Create a repository plan when work needs a durable handoff. Ground each step in current code, name the owner files or symbols, settle design decisions, and give an applicable check with its expected result. Group steps by working capability, including its validation, errors, accessibility, localization, diagnostics, and tests where relevant. Planning alone does not authorize implementation.

Use agents when the user or an applicable instruction requests delegation and the tasks have separate ownership. Record each task's owner, files, dependencies, deliverable, and verification. Keep shared files with one owner and integrate dependent edits in order. The main agent owns final verification.

Choose the least costly available model that can complete the assigned work. Start with GPT-6 Luna for narrow, settled tasks, GPT-6 Sol for coding and judgment across a feature, and GPT-6 Astra for unresolved architecture or demanding cross-layer work. Increase reasoning effort for a concrete difficulty, not by default. Keep the current session model unless the user asks to change it.

When implementing an existing plan, first compare its assignments and assumptions with the current tree. Refresh stale paths or model names, then execute authorized steps and their checks. If a planned agent is unavailable, continue sequentially and report that limit.
