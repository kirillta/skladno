export type AuthorSkillChange =
    | { kind: "create"; skillId: string; skillMarkdown: string }
    | { kind: "update"; skillId: string; skillMarkdown: string; expectedHash: string }
    | { kind: "restore"; skillId: string; revisionId: string; expectedHash: string }
    | { kind: "delete"; skillId: string; expectedHash: string };
