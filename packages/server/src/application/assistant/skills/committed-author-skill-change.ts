import type { AuthorSkillRevision } from "./author-skill-revision.js";


export type CommittedAuthorSkillChange = { kind: "create"; revision: AuthorSkillRevision; } |
{ kind: "update" | "restore"; revision: AuthorSkillRevision; previousFiles?: Readonly<Record<string, string>>; } |
{ kind: "delete"; skillId: string; previousFiles: Readonly<Record<string, string>>; };
