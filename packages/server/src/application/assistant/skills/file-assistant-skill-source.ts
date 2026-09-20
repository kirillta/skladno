import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import type { AssistantSkillReference, AssistantSkillSummary } from "@skladno/shared";

import type { AssistantSkillPackage } from "./assistant-skill-package.js";
import type { AuthorSkillPackageStatus } from "./author-skill-package-status.js";
import { parseSkillPackage } from "./skill-package-parser.js";


export class FileAssistantSkillSource {
    private packages = new Map<string, AssistantSkillPackage>();


    private invalid: AuthorSkillPackageStatus[] = [];


    constructor(
        readonly id: string,
        private readonly root: string,
        private readonly reserved: () => { ids: readonly string[]; names: readonly string[] } = () => ({ ids: [], names: [] }),
    ) { }


    summaries(): readonly AssistantSkillSummary[] {
        this.refresh();
        return [...this.packages.values()].map(({ reference, name, description }) => ({ reference, name, description }));
    }


    load(reference: AssistantSkillReference): AssistantSkillPackage | undefined {
        this.refresh();
        const loaded = this.packages.get(reference.id);
        return loaded && loaded.reference.source === reference.source && loaded.reference.version === reference.version ? loaded : undefined;
    }


    status(): readonly AuthorSkillPackageStatus[] {
        this.refresh();
        return this.invalid;
    }


    refresh(): void {
        this.packages = new Map();
        this.invalid = [];
        if (!existsSync(this.root))
            return;

        for (const entry of readdirSync(this.root, { withFileTypes: true })) {
            if (!entry.isDirectory()) {
                this.invalid.push({ directory: entry.name, issues: [{ code: "unsafe_package", messageId: "skills.validation.unsafe_package" }] });
                continue;
            }

            const parsed = parseSkillPackage({ root: resolve(this.root, entry.name), source: this.id, reservedIds: this.reserved().ids, reservedNames: this.reserved().names });
            if (!parsed.ok) {
                this.invalid.push({ directory: entry.name, issues: parsed.issues });
                continue;
            }

            if (this.packages.has(parsed.skillPackage.reference.id)) {
                this.invalid.push({ directory: entry.name, issues: [{ code: "invalid_metadata", messageId: "skills.validation.invalid_metadata" }] });
                continue;
            }

            this.packages.set(parsed.skillPackage.reference.id, parsed.skillPackage);
        }
    }


    install(input: { directory: string; files: Readonly<Record<string, string>> }): AssistantSkillPackage {
        const root = this.packageRoot(input.directory);
        if (existsSync(root))
            throw new Error("skill_package_conflict");

        const staged = `${root}.staged`;
        this.writeStaged(staged, input.files);
        const parsed = parseSkillPackage({ root: staged, source: this.id, reservedIds: this.reserved().ids, reservedNames: this.reserved().names });
        if (!parsed.ok) {
            rmSync(staged, { recursive: true, force: true });
            throw new Error(parsed.issues[0]!.code);
        }

        mkdirSync(dirname(root), { recursive: true });
        renameSync(staged, root);
        this.refresh();

        return parsed.skillPackage;
    }


    replace(input: { directory: string; files: Readonly<Record<string, string>>; expectedHash: string }): AssistantSkillPackage {
        const root = this.packageRoot(input.directory);
        const current = this.loadByDirectory(input.directory);
        if (!current || current.contentHash !== input.expectedHash)
            throw new Error("skill_package_conflict");

        const staged = `${root}.staged`;
        this.writeStaged(staged, input.files);
        const parsed = parseSkillPackage({ root: staged, source: this.id });
        if (!parsed.ok || parsed.skillPackage.reference.id !== current.reference.id || parsed.skillPackage.name !== current.name) {
            rmSync(staged, { recursive: true, force: true });
            throw new Error(parsed.ok ? "invalid_metadata" : parsed.issues[0]!.code);
        }

        renameSync(root, `${root}.previous`);
        renameSync(staged, root);
        rmSync(`${root}.previous`, { recursive: true, force: true });
        this.refresh();

        return parsed.skillPackage;
    }


    delete(input: { directory: string; expectedHash: string }): void {
        const current = this.loadByDirectory(input.directory);
        if (!current || current.contentHash !== input.expectedHash)
            throw new Error("skill_package_conflict");

        rmSync(this.packageRoot(input.directory), { recursive: true, force: false });
        this.refresh();
    }


    private loadByDirectory(directory: string): AssistantSkillPackage | undefined {
        const parsed = parseSkillPackage({ root: this.packageRoot(directory), source: this.id });
        return parsed.ok ? parsed.skillPackage : undefined;
    }


    private packageRoot(directory: string): string {
        const root = resolve(this.root, directory);
        if (dirname(root) !== resolve(this.root))
            throw new Error("invalid_skill_package");

        return root;
    }


    private writeStaged(staged: string, files: Readonly<Record<string, string>>): void {
        if (existsSync(staged))
            rmSync(staged, { recursive: true, force: true });

        for (const [relativePath, content] of Object.entries(files)) {
            if (relativePath !== "SKILL.md" && (!relativePath.startsWith("references/") || !relativePath.endsWith(".md") || relativePath.includes("..")))
                throw new Error("invalid_skill_package");

            const path = resolve(staged, relativePath);
            if (dirname(path) !== staged && dirname(dirname(path)) !== staged)
                throw new Error("invalid_skill_package");

            mkdirSync(dirname(path), { recursive: true });
            writeFileSync(path, content, { encoding: "utf8", mode: 0o600, flag: "wx" });
        }
    }
}
