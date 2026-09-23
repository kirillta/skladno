import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";

import type { AssistantSkillReference, AssistantSkillSummary } from "@skladno/shared";

import type { AssistantSkillPackage } from "./assistant-skill-package.js";
import type { AuthorSkillPackageStatus } from "./author-skill-package-status.js";
import { normalizeSkillName } from "./normalize-skill-name.js";
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


    get(id: string): AssistantSkillPackage | undefined {
        this.refresh();
        return this.packages.get(id);
    }


    directoryPath(id: string): string | undefined {
        return this.loadByDirectory(id) ? this.packageRoot(id) : undefined;
    }


    readFiles(directory: string): Readonly<Record<string, string>> | undefined {
        if (!this.loadByDirectory(directory))
            return undefined;

        const root = this.packageRoot(directory);
        const files: Record<string, string> = { "SKILL.md": readFileSync(resolve(root, "SKILL.md"), "utf8") };
        const references = resolve(root, "references");
        if (!existsSync(references))
            return files;

        for (const entry of readdirSync(references, { withFileTypes: true })) {
            if (!entry.isFile())
                return undefined;

            files[`references/${entry.name}`] = readFileSync(resolve(references, entry.name), "utf8");
        }

        return files;
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

        const reserved = this.reserved();
        const names = new Set<string>();
        for (const entry of readdirSync(this.root, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
            if (entry.name.endsWith(".staged") || entry.name.endsWith(".previous"))
                continue;

            if (!entry.isDirectory()) {
                this.invalid.push({ directory: entry.name, issues: [{ code: "unsafe_package", messageId: "skills.validation.unsafe_package" }] });
                continue;
            }

            const parsed = parseSkillPackage({ root: resolve(this.root, entry.name), source: this.id, reservedIds: reserved.ids, reservedNames: reserved.names });
            if (!parsed.ok) {
                this.invalid.push({ directory: entry.name, issues: parsed.issues });
                continue;
            }

            if (this.packages.has(parsed.skillPackage.reference.id) || names.has(normalizeSkillName(parsed.skillPackage.name))) {
                this.invalid.push({ directory: entry.name, issues: [{ code: "invalid_metadata", messageId: "skills.validation.invalid_metadata" }] });
                continue;
            }

            this.packages.set(parsed.skillPackage.reference.id, parsed.skillPackage);
            names.add(normalizeSkillName(parsed.skillPackage.name));
        }
    }


    install(input: { directory: string; files: Readonly<Record<string, string>> }): AssistantSkillPackage {
        const root = this.packageRoot(input.directory);
        if (existsSync(root))
            throw new Error("skill_package_conflict");

        this.refresh();
        const staged = `${root}.staged`;
        this.writeStaged(staged, input.files);
        const parsed = parseSkillPackage({ root: staged, source: this.id, reservedIds: this.reserved().ids, reservedNames: this.reserved().names });
        if (!parsed.ok) {
            rmSync(staged, { recursive: true, force: true });
            throw new Error(parsed.issues[0]!.code);
        }

        if (parsed.skillPackage.reference.id !== input.directory) {
            rmSync(staged, { recursive: true, force: true });
            throw new Error("invalid_metadata");
        }

        if (!this.isAvailable(parsed.skillPackage)) {
            rmSync(staged, { recursive: true, force: true });
            throw new Error("skill_package_conflict");
        }

        mkdirSync(dirname(root), { recursive: true });
        renameSync(staged, root);
        this.refresh();

        return parsed.skillPackage;
    }


    validateInstall(input: { directory: string; files: Readonly<Record<string, string>> }): void {
        const root = this.packageRoot(input.directory);
        if (existsSync(root))
            throw new Error("skill_package_conflict");

        this.refresh();
        const staged = `${root}.${randomUUID()}.staged`;
        try {
            this.writeStaged(staged, input.files);
            const parsed = parseSkillPackage({ root: staged, source: this.id, reservedIds: this.reserved().ids, reservedNames: this.reserved().names });
            if (!parsed.ok)
                throw new Error(parsed.issues[0]!.code);

            if (parsed.skillPackage.reference.id !== input.directory)
                throw new Error("invalid_metadata");

            if (!this.isAvailable(parsed.skillPackage))
                throw new Error("skill_package_conflict");
        } finally {
            rmSync(staged, { recursive: true, force: true });
        }
    }


    validateReplace(input: { directory: string; files: Readonly<Record<string, string>>; expectedHash: string }): void {
        this.refresh();
        const current = this.loadByDirectory(input.directory);
        if (!current || current.contentHash !== input.expectedHash)
            throw new Error("skill_package_conflict");

        const staged = `${this.packageRoot(input.directory)}.${randomUUID()}.staged`;
        try {
            this.writeStaged(staged, input.files);
            const parsed = parseSkillPackage({ root: staged, source: this.id, reservedIds: this.reserved().ids, reservedNames: this.reserved().names });
            if (!parsed.ok || parsed.skillPackage.reference.id !== current.reference.id || !this.isAvailable(parsed.skillPackage, current.reference.id))
                throw new Error(parsed.ok ? "invalid_metadata" : parsed.issues[0]!.code);
        } finally {
            rmSync(staged, { recursive: true, force: true });
        }
    }


    replace(input: { directory: string; files: Readonly<Record<string, string>>; expectedHash: string }): AssistantSkillPackage {
        const root = this.packageRoot(input.directory);
        this.refresh();
        const current = this.loadByDirectory(input.directory);
        if (!current || current.contentHash !== input.expectedHash)
            throw new Error("skill_package_conflict");

        const staged = `${root}.staged`;
        this.writeStaged(staged, input.files);
        const parsed = parseSkillPackage({ root: staged, source: this.id, reservedIds: this.reserved().ids, reservedNames: this.reserved().names });
        if (!parsed.ok || parsed.skillPackage.reference.id !== current.reference.id || !this.isAvailable(parsed.skillPackage, current.reference.id)) {
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


    recoverPending(directory: string, previousFiles?: Readonly<Record<string, string>>, nextFiles?: Readonly<Record<string, string>>): void {
        const root = this.packageRoot(directory);
        if (existsSync(root)) {
            const current = this.readFiles(directory);
            if (!current || (!this.sameFiles(current, previousFiles) && !this.sameFiles(current, nextFiles)))
                throw new Error("skill_package_conflict");
        }

        rmSync(root, { recursive: true, force: true });
        rmSync(`${root}.staged`, { recursive: true, force: true });
        rmSync(`${root}.previous`, { recursive: true, force: true });
        if (previousFiles)
            this.install({ directory, files: previousFiles });
        else
            this.refresh();
    }


    private sameFiles(left: Readonly<Record<string, string>>, right?: Readonly<Record<string, string>>): boolean {
        if (!right)
            return false;

        return Object.keys(left).length === Object.keys(right).length
            && Object.entries(left).every(([path, content]) => right[path] === content);
    }


    private loadByDirectory(directory: string): AssistantSkillPackage | undefined {
        const reserved = this.reserved();
        const parsed = parseSkillPackage({ root: this.packageRoot(directory), source: this.id, reservedIds: reserved.ids, reservedNames: reserved.names });
        return parsed.ok ? parsed.skillPackage : undefined;
    }


    private isAvailable(skillPackage: AssistantSkillPackage, replacedId?: string): boolean {
        return !Array.from(this.packages.values()).some((candidate) => candidate.reference.id !== replacedId
            && (candidate.reference.id === skillPackage.reference.id || normalizeSkillName(candidate.name) === normalizeSkillName(skillPackage.name)));
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
