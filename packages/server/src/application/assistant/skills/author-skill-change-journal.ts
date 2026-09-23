export interface PendingSkillChange {
    requestId: string;
    skillId: string;
    previousFiles?: Readonly<Record<string, string>>;
    nextFiles?: Readonly<Record<string, string>>;
}


export interface AuthorSkillChangeJournal {
    begin(change: PendingSkillChange): void;
    list(): readonly PendingSkillChange[];
    remove(requestId: string): void;
}
