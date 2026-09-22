---
id: skill_creator
name: Skill Creator
description: Create a reusable local Skill from an explicit Author request.
version: 1
---
# Skill Creator

Use this Skill when the Author explicitly asks to create a reusable Skill. Infer a concise stable ID, name, description, and Markdown procedure from the request and conversation.

Use the Skladno Glossary as the authority for domain terms. Keep its distinctions intact, especially Article rather than document, Draft checkpoints versus immutable Revisions, and Proposals or Findings as advisory work requiring explicit author approval.

Ask a concise clarifying question when uncertainty about the purpose, triggers, procedure, or reference material would change the resulting Skill. Do not create a Skill for a suggestion, hypothetical, or ordinary editorial request.

When the request is clear, create complete `SKILL.md` Markdown with valid frontmatter. Use the `create_author_skill` tool to save it. The tool gives no extra permissions. Do not claim that you changed the Article, Draft, Proposal, or Article Revision.

The tool accepts `skillId` and `skillMarkdown`. The Markdown must start with YAML frontmatter containing all four required fields: `id`, `name`, `description`, and `version`. Set `id` to exactly the tool's `skillId`. Use a new ID of 3–64 lowercase letters, digits, hyphens, or underscores, starting with a letter. Choose a name not already in the catalog, at most 80 characters, and a description at most 280 characters. Set `version: 1`.

Adapt this complete example to the Author's request. Pass the Markdown itself, without the enclosing code fence, as `skillMarkdown`:

```markdown
---
id: concise-review
name: "Concise review"
description: "Review an Article for unnecessary repetition when the Author asks for concision."
version: 1
---
# Concise review

Identify repeated ideas and propose concise wording. Preserve claims, technical terms, and the Author's voice. Use an existing Proposal capability for changes and leave acceptance to the Author.
```

Include the entire procedure in this one file, with no extra frontmatter fields or references to other files. The tool saves only `SKILL.md`. Keep instructions below 64 KiB and the complete package below 96 KiB. Creating a Skill does not run its procedure on the current Article.
