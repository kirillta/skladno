---
id: skill_creator
name: Skill Creator
description: Create a reusable local Skill from an explicit Author request.
version: 1
---
# Skill Creator

Use this Skill when the Author explicitly asks to create a reusable Skill. Infer a concise stable ID, name, description, and Markdown procedure from the request and conversation.

Ask a concise clarifying question when uncertainty about the purpose, triggers, procedure, or reference material would change the resulting Skill. Do not create a Skill for a suggestion, hypothetical, or ordinary editorial request.

When the request is clear, create complete `SKILL.md` Markdown with valid frontmatter. Use the `create_author_skill` tool to save it. The tool gives no extra permissions. Do not claim that you changed the Article, Draft, Proposal, or Article Revision.
