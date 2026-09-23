import type { AssistantSkillPackage } from "./assistant-skill-package.js";
import type { AuthorSkillRevisionStore } from "./author-skill-revision-store.js";
import type { AuthorSkillRevision } from "./author-skill-revision.js";
import type { AuthorSkillChange } from "./author-skill-change.js";
import type { CommittedAuthorSkillChange } from "./committed-author-skill-change.js";
import type { AuthorSkillChangeJournal, PendingSkillChange } from "./author-skill-change-journal.js";
import { FileAssistantSkillSource } from "./file-assistant-skill-source.js";


export class AuthorSkillService {
    constructor(
        private readonly source: FileAssistantSkillSource,
        private readonly revisions: AuthorSkillRevisionStore,
        private readonly journal?: AuthorSkillChangeJournal,
    ) { }


    validateCreate(input: { skillId: string; files: Readonly<Record<string, string>> }): void {
        this.source.validateInstall({ directory: input.skillId, files: input.files });
    }


    readCurrent(skillId: string): { contentHash: string; files: Readonly<Record<string, string>> } | undefined {
        const skillPackage = this.source.get(skillId);
        const files = this.source.readFiles(skillId);
        return skillPackage?.contentHash && files ? { contentHash: skillPackage.contentHash, files } : undefined;
    }


    readRevision(skillId: string, revisionId: string): Readonly<Record<string, string>> | undefined {
        return this.revisions.readFiles({ skillId, revisionId });
    }


    validateChange(change: AuthorSkillChange): void {
        if (change.kind === "create") {
            this.validateCreate({ skillId: change.skillId, files: { "SKILL.md": change.skillMarkdown } });
            return;
        }

        const current = this.readCurrent(change.skillId);
        if (current ? current.contentHash !== change.expectedHash : change.kind !== "restore" || change.expectedHash !== "")
            throw new Error("skill_package_conflict");

        if (change.kind === "delete")
            return;

        if (change.kind === "update") {
            if (!current)
                throw new Error("skill_package_conflict");

            this.source.validateReplace({ directory: change.skillId, expectedHash: change.expectedHash, files: this.withNextVersion(change.skillId, { ...current.files, "SKILL.md": change.skillMarkdown }) });
            return;
        }

        const files = this.readRevision(change.skillId, change.revisionId);
        if (!files)
            throw new Error("skill_revision_not_found");

        const replacement = current ? this.withNextVersion(change.skillId, files) : this.withVersionAfterHistory(change.skillId, files);
        if (current)
            this.source.validateReplace({ directory: change.skillId, expectedHash: change.expectedHash, files: replacement });
        else
            this.source.validateInstall({ directory: change.skillId, files: replacement });
    }


    commitChange(change: AuthorSkillChange, requestId: string): CommittedAuthorSkillChange {
        this.validateChange(change);
        const previousFiles = this.readCurrent(change.skillId)?.files;
        const nextFiles = this.filesForChange(change, previousFiles);
        const pending = { requestId, skillId: change.skillId, ...(previousFiles ? { previousFiles } : {}), ...(nextFiles ? { nextFiles } : {}) };
        this.journal?.begin(pending);
        try {
            return this.commitValidatedChange(change, requestId);
        } catch (error) {
            if (this.journal)
                this.recoverRequest(pending);

            throw error;
        }
    }


    private commitValidatedChange(change: AuthorSkillChange, requestId: string): CommittedAuthorSkillChange {
        if (change.kind === "create")
            return { kind: "create", revision: this.create({ skillId: change.skillId, files: { "SKILL.md": change.skillMarkdown }, requestId }) };

        const previousFiles = this.readCurrent(change.skillId)?.files;
        if (change.kind === "delete") {
            if (!previousFiles)
                throw new Error("skill_package_conflict");

            this.delete(change);
            return { kind: "delete", skillId: change.skillId, previousFiles };
        }

        let revision: AuthorSkillRevision;
        if (change.kind === "update") {
            if (!previousFiles)
                throw new Error("skill_package_conflict");

            revision = this.update({ skillId: change.skillId, files: { ...previousFiles, "SKILL.md": change.skillMarkdown }, expectedHash: change.expectedHash, requestId });
        } else {
            revision = this.restore({ skillId: change.skillId, revisionId: change.revisionId, expectedHash: change.expectedHash, requestId });
        }

        return { kind: change.kind, revision, ...(previousFiles ? { previousFiles } : {}) };
    }


    finishChange(requestId: string): void {
        this.journal?.remove(requestId);
    }


    recoverIncompleteChanges(isCompleted: (requestId: string) => boolean): void {
        for (const pending of this.journal?.list() ?? []) {
            if (isCompleted(pending.requestId)) {
                this.finishChange(pending.requestId);
                continue;
            }

            this.recoverRequest(pending);
        }
    }


    private recoverRequest(pending: PendingSkillChange): void {
        this.source.recoverPending(pending.skillId, pending.previousFiles, pending.nextFiles);
        this.revisions.removeForRequest(pending.skillId, pending.requestId);
        this.finishChange(pending.requestId);
    }


    private filesForChange(change: AuthorSkillChange, previousFiles?: Readonly<Record<string, string>>): Readonly<Record<string, string>> | undefined {
        if (change.kind === "create")
            return { "SKILL.md": change.skillMarkdown };

        if (change.kind === "delete")
            return undefined;

        if (change.kind === "update")
            return this.withNextVersion(change.skillId, { ...previousFiles, "SKILL.md": change.skillMarkdown });

        const files = this.readRevision(change.skillId, change.revisionId);
        if (!files)
            throw new Error("skill_revision_not_found");

        return previousFiles ? this.withNextVersion(change.skillId, files) : this.withVersionAfterHistory(change.skillId, files);
    }


    rollbackChange(change: CommittedAuthorSkillChange): void {
        if (change.kind === "create") {
            this.rollbackCreate(change.revision);
            return;
        }

        if (change.kind === "delete") {
            this.source.install({ directory: change.skillId, files: change.previousFiles });
            return;
        }

        if (!change.previousFiles) {
            this.rollbackCreate(change.revision);
            return;
        }

        this.source.replace({ directory: change.revision.skillId, files: change.previousFiles, expectedHash: change.revision.contentHash });
        this.revisions.removeCreated(change.revision);
    }


    rollbackCreate(revision: AuthorSkillRevision): void {
        this.source.delete({ directory: revision.skillId, expectedHash: revision.contentHash });
        this.revisions.removeCreated(revision);
    }


    create(input: { skillId: string; files: Readonly<Record<string, string>>; requestId?: string }): AuthorSkillRevision {
        const skillPackage = this.source.install({ directory: input.skillId, files: input.files });
        try {
            return this.record({ skillPackage, files: input.files, requestId: input.requestId });
        } catch (error) {
            this.source.delete({ directory: input.skillId, expectedHash: skillPackage.contentHash ?? "" });
            throw error;
        }
    }


    update(input: { skillId: string; files: Readonly<Record<string, string>>; expectedHash: string; requestId?: string }): AuthorSkillRevision {
        const previous = this.snapshotCurrent(input.skillId);
        const files = this.withNextVersion(input.skillId, input.files);
        const skillPackage = this.source.replace({ directory: input.skillId, files, expectedHash: input.expectedHash });
        try {
            return this.record({ skillPackage, files, requestId: input.requestId });
        } catch (error) {
            this.source.replace({ directory: input.skillId, files: previous.files, expectedHash: skillPackage.contentHash ?? "" });
            throw error;
        }
    }


    restore(input: { skillId: string; revisionId: string; expectedHash: string; requestId?: string }): AuthorSkillRevision {
        const files = this.revisions.readFiles({ skillId: input.skillId, revisionId: input.revisionId });
        if (!files)
            throw new Error("skill_revision_not_found");

        const current = this.source.get(input.skillId);
        if (!current && input.expectedHash !== "")
            throw new Error("skill_package_conflict");

        const previous = current ? this.snapshotCurrent(input.skillId) : undefined;
        const replacement = current ? this.withNextVersion(input.skillId, files) : this.withVersionAfterHistory(input.skillId, files);
        const skillPackage = current
            ? this.source.replace({ directory: input.skillId, files: replacement, expectedHash: input.expectedHash })
            : this.source.install({ directory: input.skillId, files: replacement });
        try {
            return this.record({ skillPackage, files: replacement, requestId: input.requestId, restoredFromId: input.revisionId });
        } catch (error) {
            if (previous)
                this.source.replace({ directory: input.skillId, files: previous.files, expectedHash: skillPackage.contentHash ?? "" });
            else
                this.source.delete({ directory: input.skillId, expectedHash: skillPackage.contentHash ?? "" });

            throw error;
        }
    }


    delete(input: { skillId: string; expectedHash: string }): void {
        this.snapshotCurrent(input.skillId);
        this.source.delete({ directory: input.skillId, expectedHash: input.expectedHash });
    }


    listRevisions(skillId: string): readonly AuthorSkillRevision[] {
        return this.revisions.list(skillId);
    }


    createdSkillDirectory(requestId: string): string | undefined {
        for (const skill of this.source.summaries()) {
            if (this.revisions.list(skill.reference.id).some((revision) => revision.requestId === requestId))
                return this.source.directoryPath(skill.reference.id);
        }

        return undefined;
    }


    private record(input: { skillPackage: AssistantSkillPackage; files: Readonly<Record<string, string>>; requestId?: string; restoredFromId?: string }): AuthorSkillRevision {
        if (!input.skillPackage.contentHash)
            throw new Error("invalid_skill_package");

        const latest = this.revisions.list(input.skillPackage.reference.id).at(-1);
        return this.revisions.create({
            skillId: input.skillPackage.reference.id,
            contentHash: input.skillPackage.contentHash,
            files: input.files,
            ...(latest ? { parentId: latest.id } : {}),
            ...(input.restoredFromId ? { restoredFromId: input.restoredFromId } : {}),
            ...(input.requestId ? { requestId: input.requestId } : {}),
        });
    }


    private snapshotCurrent(skillId: string): { files: Readonly<Record<string, string>> } {
        const skillPackage = this.source.get(skillId);
        const files = this.source.readFiles(skillId);
        if (!skillPackage || !files || !skillPackage.contentHash)
            throw new Error("skill_package_conflict");

        if (!this.revisions.list(skillId).some((revision) => revision.contentHash === skillPackage.contentHash))
            this.record({ skillPackage, files });

        return { files };
    }


    private withNextVersion(skillId: string, files: Readonly<Record<string, string>>): Readonly<Record<string, string>> {
        const current = this.source.get(skillId);
        if (!current)
            throw new Error("skill_package_conflict");

        return this.withVersionAfter(current.reference.version, files);
    }


    private withVersionAfterHistory(skillId: string, files: Readonly<Record<string, string>>): Readonly<Record<string, string>> {
        const latest = this.revisions.list(skillId).at(-1);
        const markdown = latest && this.revisions.readFiles({ skillId, revisionId: latest.id })?.["SKILL.md"];
        const version = markdown && /^version:\s*["']?(\d+(?:\.\d+){0,2})["']?\s*$/m.exec(markdown)?.[1];
        if (!version)
            throw new Error("invalid_skill_revision");

        return this.withVersionAfter(version, files);
    }


    private withVersionAfter(version: string, files: Readonly<Record<string, string>>): Readonly<Record<string, string>> {
        const parts = version.split(".");
        const last = parts.at(-1);
        if (!last)
            throw new Error("invalid_skill_package");

        parts[parts.length - 1] = String(Number(last) + 1);
        const markdown = files["SKILL.md"];
        if (!markdown)
            throw new Error("invalid_skill_package");

        const nextMarkdown = markdown.replace(/^(version:\s*)(?:"[^"]+"|'[^']+'|\d+(?:\.\d+){0,2})\s*$/m, `$1${parts.join(".")}`);
        return { ...files, "SKILL.md": nextMarkdown };
    }
}
