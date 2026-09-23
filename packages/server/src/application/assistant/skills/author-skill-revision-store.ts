import { AuthorSkillRevision } from "./author-skill-revision.js";
import { CreateAuthorSkillRevisionInput } from "./create-author-skill-revision-input.js";


export interface AuthorSkillRevisionStore {
    create(input: CreateAuthorSkillRevisionInput): AuthorSkillRevision;
    list(skillId: string): readonly AuthorSkillRevision[];
    readFiles(input: { skillId: string; revisionId: string }): Readonly<Record<string, string>> | undefined;
    removeCreated(revision: AuthorSkillRevision): void;
    removeForRequest(skillId: string, requestId: string): void;
}
