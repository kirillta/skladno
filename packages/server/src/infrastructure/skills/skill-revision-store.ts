import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname, join, relative, resolve, sep } from "node:path";

import type { AuthorSkillRevisionStore } from "../../application/assistant/skills/author-skill-revision-store.js";
import type { CreateAuthorSkillRevisionInput } from "../../application/assistant/skills/create-author-skill-revision-input.js";
import type { AuthorSkillRevision } from "../../application/assistant/skills/author-skill-revision.js";


const skillId = /^[a-z][a-z0-9_-]{2,63}$/;
const revisionId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;


function isPackageFile(path: string): boolean {
    return path === "SKILL.md" || /^references\/[A-Za-z0-9_-]+\.md$/.test(path);
}


function isInside(root: string, path: string): boolean {
    const resolved = relative(root, path);
    return resolved !== "" && resolved !== ".." && !resolved.startsWith(`..${sep}`);
}


function parseRevision(value: unknown): AuthorSkillRevision | undefined {
    if (typeof value !== "object" || value === null || Array.isArray(value))
        return undefined;

    const candidate = value as Record<string, unknown>;
    if (!revisionId.test(String(candidate.id)) || !skillId.test(String(candidate.skillId)) || typeof candidate.contentHash !== "string" || typeof candidate.createdAt !== "string")
        return undefined;

    const optionalIds = [candidate.parentId, candidate.restoredFromId];
    if (optionalIds.some((id) => id !== undefined && (typeof id !== "string" || !revisionId.test(id))))
        return undefined;

    if (candidate.requestId !== undefined && typeof candidate.requestId !== "string")
        return undefined;

    return {
        id: candidate.id as string,
        skillId: candidate.skillId as string,
        contentHash: candidate.contentHash,
        createdAt: candidate.createdAt,
        ...(typeof candidate.parentId === "string" ? { parentId: candidate.parentId } : {}),
        ...(typeof candidate.restoredFromId === "string" ? { restoredFromId: candidate.restoredFromId } : {}),
        ...(typeof candidate.requestId === "string" ? { requestId: candidate.requestId } : {}),
    };
}


/** Persists immutable, server-owned snapshots of Author Skill Markdown packages. */
export class SkillRevisionStore implements AuthorSkillRevisionStore {
    constructor(
        private readonly dataRoot: string,
        private readonly now = () => new Date(),
        private readonly createId: () => string = () => randomUUID(),
    ) { }


    create(input: CreateAuthorSkillRevisionInput): AuthorSkillRevision {
        if (!skillId.test(input.skillId) || Object.keys(input.files).length === 0 || Object.entries(input.files).some(([path, content]) => !isPackageFile(path) || typeof content !== "string"))
            throw new Error("invalid_skill_revision");

        const revision: AuthorSkillRevision = {
            id: this.createId(),
            skillId: input.skillId,
            contentHash: input.contentHash,
            createdAt: this.now().toISOString(),
            ...(input.parentId ? { parentId: input.parentId } : {}),
            ...(input.restoredFromId ? { restoredFromId: input.restoredFromId } : {}),
            ...(input.requestId ? { requestId: input.requestId } : {}),
        };
        if (!revisionId.test(revision.id))
            throw new Error("invalid_skill_revision");

        const root = this.revisionRoot(revision);
        if (existsSync(root))
            throw new Error("skill_revision_conflict");

        for (const [path, content] of Object.entries(input.files))
            this.writeFile(join(root, "package"), path, content);

        mkdirSync(root, { recursive: true });
        writeFileSync(join(root, "revision.json"), JSON.stringify(revision), { encoding: "utf8", mode: 0o600, flag: "wx" });
        this.writeState(revision);

        return revision;
    }


    list(skillIdValue: string): readonly AuthorSkillRevision[] {
        if (!skillId.test(skillIdValue))
            return [];

        const root = this.skillRoot(skillIdValue);
        if (!existsSync(root))
            return [];

        const revisions: AuthorSkillRevision[] = [];
        for (const entry of readdirSync(root, { withFileTypes: true })) {
            if (!entry.isDirectory() || !revisionId.test(entry.name))
                continue;

            const revision = this.readRevision(join(root, entry.name, "revision.json"));
            if (revision?.skillId === skillIdValue)
                revisions.push(revision);
        }

        return revisions.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
    }


    readFiles(input: { skillId: string; revisionId: string }): Readonly<Record<string, string>> | undefined {
        if (!skillId.test(input.skillId) || !revisionId.test(input.revisionId))
            return undefined;

        const root = join(this.skillRoot(input.skillId), input.revisionId, "package");
        const revision = this.readRevision(join(dirname(root), "revision.json"));
        if (!revision || revision.skillId !== input.skillId)
            return undefined;

        const files: Record<string, string> = {};
        this.readPackageFiles(root, files);
        return Object.keys(files).length > 0 ? files : undefined;
    }


    private skillRoot(skillIdValue: string): string {
        return join(resolve(this.dataRoot), "skill-history", skillIdValue);
    }


    private revisionRoot(revision: AuthorSkillRevision): string {
        return join(this.skillRoot(revision.skillId), revision.id);
    }


    private writeFile(root: string, path: string, content: string): void {
        const destination = resolve(root, path);
        if (!isPackageFile(path) || !isInside(root, destination))
            throw new Error("invalid_skill_revision");

        mkdirSync(dirname(destination), { recursive: true });
        writeFileSync(destination, content, { encoding: "utf8", mode: 0o600, flag: "wx" });
    }


    private writeState(revision: AuthorSkillRevision): void {
        const root = this.skillRoot(revision.skillId);
        mkdirSync(root, { recursive: true });
        const staged = join(root, `.state-${revision.id}.json`);
        writeFileSync(staged, JSON.stringify({ latestRevisionId: revision.id }), { encoding: "utf8", mode: 0o600, flag: "wx" });
        renameSync(staged, join(root, "state.json"));
    }


    private readRevision(path: string): AuthorSkillRevision | undefined {
        try {
            return parseRevision(JSON.parse(readFileSync(path, "utf8")));
        } catch {
            return undefined;
        }
    }


    private readPackageFiles(root: string, files: Record<string, string>): void {
        if (!existsSync(root))
            return;

        for (const entry of readdirSync(root, { withFileTypes: true })) {
            const path = join(root, entry.name);
            if (entry.isDirectory()) {
                if (entry.name !== "references")
                    return;

                this.readPackageFiles(path, files);
                continue;
            }

            const relativePath = relative(root.endsWith(`${sep}references`) ? dirname(root) : root, path).replaceAll(sep, "/");
            if (!entry.isFile() || lstatSync(path).isSymbolicLink() || !isPackageFile(relativePath))
                return;

            files[relativePath] = readFileSync(path, "utf8");
        }
    }
}
