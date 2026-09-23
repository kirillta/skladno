import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { AuthorSkillChangeJournal, PendingSkillChange } from "../../application/assistant/skills/author-skill-change-journal.js";


function parsePending(value: unknown): PendingSkillChange {
    if (typeof value !== "object" || value === null || Array.isArray(value))
        throw new Error("invalid_skill_journal");

    const change = value as Record<string, unknown>;
    if (typeof change.requestId !== "string" || !change.requestId || typeof change.skillId !== "string" || !/^[a-z][a-z0-9_-]{2,63}$/.test(change.skillId))
        throw new Error("invalid_skill_journal");

    for (const files of [change.previousFiles, change.nextFiles]) {
        if (files !== undefined && (typeof files !== "object" || files === null || Array.isArray(files)
            || Object.entries(files).some(([path, content]) => (path !== "SKILL.md" && !/^references\/[A-Za-z0-9_-]+\.md$/.test(path)) || typeof content !== "string")))
            throw new Error("invalid_skill_journal");
    }

    return {
        requestId: change.requestId,
        skillId: change.skillId,
        ...(change.previousFiles ? { previousFiles: change.previousFiles as Record<string, string> } : {}),
        ...(change.nextFiles ? { nextFiles: change.nextFiles as Record<string, string> } : {}),
    };
}


export class SkillChangeJournal implements AuthorSkillChangeJournal {
    private readonly root: string;


    constructor(dataRoot: string) {
        this.root = join(dataRoot, "skill-staging");
    }


    begin(change: PendingSkillChange): void {
        mkdirSync(this.root, { recursive: true });
        const path = this.path(change.requestId);
        if (existsSync(path))
            throw new Error("skill_package_conflict");

        const staged = `${path}.${randomUUID()}.staged`;
        writeFileSync(staged, JSON.stringify(change), { encoding: "utf8", mode: 0o600, flag: "wx" });
        renameSync(staged, path);
    }


    list(): readonly PendingSkillChange[] {
        if (!existsSync(this.root))
            return [];

        return readdirSync(this.root)
            .filter((name) => name.endsWith(".json"))
            .map((name) => parsePending(JSON.parse(readFileSync(join(this.root, name), "utf8"))));
    }


    remove(requestId: string): void {
        rmSync(this.path(requestId), { force: true });
    }


    private path(requestId: string): string {
        const name = createHash("sha256").update(requestId).digest("hex");
        return join(this.root, `${name}.json`);
    }
}
