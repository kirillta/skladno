export interface AuthorSkillRevision {
    id: string;
    skillId: string;
    contentHash: string;
    createdAt: string;
    parentId?: string;
    restoredFromId?: string;
    requestId?: string;
}
