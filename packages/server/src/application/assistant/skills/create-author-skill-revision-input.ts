
export interface CreateAuthorSkillRevisionInput {
    skillId: string;
    contentHash: string;
    files: Readonly<Record<string, string>>;
    parentId?: string;
    restoredFromId?: string;
    requestId?: string;
}
