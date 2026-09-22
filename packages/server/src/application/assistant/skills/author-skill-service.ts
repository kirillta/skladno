import type { AssistantSkillPackage } from "./assistant-skill-package.js";
import type { AuthorSkillRevisionStore } from "./author-skill-revision-store.js";
import type { AuthorSkillRevision } from "./author-skill-revision.js";
import { FileAssistantSkillSource } from "./file-assistant-skill-source.js";


export class AuthorSkillService {
    constructor(
        private readonly source: FileAssistantSkillSource,
        private readonly revisions: AuthorSkillRevisionStore,
    ) { }


    validateCreate(input: { skillId: string; files: Readonly<Record<string, string>> }): void {
        this.source.validateInstall({ directory: input.skillId, files: input.files });
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

        const previous = this.snapshotCurrent(input.skillId);
        const replacement = this.withNextVersion(input.skillId, files);
        const skillPackage = this.source.replace({ directory: input.skillId, files: replacement, expectedHash: input.expectedHash });
        try {
            return this.record({ skillPackage, files: replacement, requestId: input.requestId, restoredFromId: input.revisionId });
        } catch (error) {
            this.source.replace({ directory: input.skillId, files: previous.files, expectedHash: skillPackage.contentHash ?? "" });
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

        const parts = current.reference.version.split(".");
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
