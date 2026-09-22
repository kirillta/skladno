import { createHash, randomUUID } from "node:crypto";
import { copyFileSync, cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { BackupBundleManifest } from "@skladno/shared";

import { validateDatabaseSnapshot } from "./database.js";


interface Snapshot { path: string; cleanup(): void }


interface Session { directory: string; manifest: BackupBundleManifest; kind: "export" | "import"; expiry: ReturnType<typeof setTimeout> }


const skillDirectories = ["skills", "skill-history"] as const;
const safePart = /^[a-zA-Z0-9_-][a-zA-Z0-9._-]*$/;


function isSafeBundlePath(path: string): boolean {
    if (path === "database.sqlite")
        return true;

    const parts = path.split("/");
    return parts.length >= 2 && skillDirectories.some((directory) => directory === parts[0])
        && parts.every((part) => part !== "." && part !== ".." && safePart.test(part));
}


function fileRecord(root: string, path: string): BackupBundleManifest["files"][number] {
    const bytes = readFileSync(join(root, ...path.split("/")));
    return { path, size: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") };
}


function visit(directory: string, prefix: string, root: string, files: BackupBundleManifest["files"]): void {
    for (const name of readdirSync(directory)) {
        const path = `${prefix}/${name}`;
        if (!isSafeBundlePath(path))
            throw new Error("backup_bundle_unsafe_path");

        const absolute = join(directory, name);
        const stat = lstatSync(absolute);
        if (stat.isDirectory())
            visit(absolute, path, root, files);
        else if (stat.isFile())
            files.push(fileRecord(root, path));
        else
            throw new Error("backup_bundle_unsafe_file");
    }
}


function inventory(root: string): BackupBundleManifest["files"] {
    const files: BackupBundleManifest["files"] = [];
    for (const directory of skillDirectories) {
        const absolute = join(root, directory);
        if (existsSync(absolute)) {
            if (!lstatSync(absolute).isDirectory())
                throw new Error("backup_bundle_unsafe_file");

            visit(absolute, directory, root, files);
        }
    }

    return files.sort((first, second) => first.path.localeCompare(second.path));
}


function sameFiles(first: BackupBundleManifest["files"], second: BackupBundleManifest["files"]): boolean {
    return JSON.stringify(first) === JSON.stringify(second);
}


export function validateBackupBundle(directory: string, manifest: BackupBundleManifest): void {
    if (manifest.format !== 1 || !Array.isArray(manifest.files) || manifest.files.length > 10_000)
        throw new Error("backup_bundle_invalid_manifest");

    const paths = manifest.files.map((file) => file.path);
    if (paths[0] !== "database.sqlite" || new Set(paths).size !== paths.length
        || paths.some((path) => !isSafeBundlePath(path)))
        throw new Error("backup_bundle_invalid_manifest");

    const actual = [fileRecord(directory, "database.sqlite"), ...inventory(directory)];
    if (!sameFiles(manifest.files, actual))
        throw new Error("backup_bundle_invalid_manifest");

    validateDatabaseSnapshot(join(directory, "database.sqlite"));
}


export class BackupBundleTransfers {
    private readonly sessions = new Map<string, Session>();


    constructor(
        private readonly dataDirectory: string,
        private readonly createSnapshot: () => Snapshot,
        private readonly restore: (directory: string, manifest: BackupBundleManifest) => Promise<void>,
    ) { }


    createExport(): { id: string; manifest: BackupBundleManifest } {
        const directory = mkdtempSync(join(tmpdir(), "skladno-backup-export-"));
        let snapshot: Snapshot | undefined;
        try {
            const before = inventory(this.dataDirectory);
            snapshot = this.createSnapshot();
            copyFileSync(snapshot.path, join(directory, "database.sqlite"));
            for (const name of skillDirectories) {
                const source = join(this.dataDirectory, name);
                if (existsSync(source))
                    cpSync(source, join(directory, name), { recursive: true, errorOnExist: true });
            }

            const copied = inventory(directory);
            if (!sameFiles(before, inventory(this.dataDirectory)) || !sameFiles(before, copied))
                throw new Error("backup_bundle_changed");

            const manifest: BackupBundleManifest = { format: 1, files: [fileRecord(directory, "database.sqlite"), ...copied] };
            if (!isBackupBundleManifest(manifest))
                throw new Error("backup_bundle_too_large");

            writeFileSync(join(directory, "manifest.json"), JSON.stringify(manifest));
            const id = randomUUID();
            this.addSession(id, { directory, manifest, kind: "export" });
            return { id, manifest };
        } catch (error) {
            rmSync(directory, { recursive: true, force: true });
            throw error;
        } finally {
            snapshot?.cleanup();
        }
    }


    readExport(id: string, index: number): Uint8Array {
        const session = this.getSession(id, "export");
        const file = session.manifest.files[index];
        if (!file)
            throw new Error("backup_bundle_invalid_file");

        const actual = fileRecord(session.directory, file.path);
        if (!sameFiles([file], [actual]))
            throw new Error("backup_bundle_changed");

        return readFileSync(join(session.directory, ...file.path.split("/")));
    }


    beginImport(value: unknown): string {
        if (!isBackupBundleManifest(value))
            throw new Error("backup_bundle_invalid_manifest");

        const directory = mkdtempSync(join(tmpdir(), "skladno-backup-import-"));
        const id = randomUUID();
        this.addSession(id, { directory, manifest: value, kind: "import" });
        return id;
    }


    writeImport(id: string, index: number, bytes: Uint8Array): void {
        const session = this.getSession(id, "import");
        const file = session.manifest.files[index];
        if (!file || bytes.length !== file.size || bytes.length > 100_000_000)
            throw new Error("backup_bundle_invalid_file");

        const target = join(session.directory, ...file.path.split("/"));
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, bytes, { flag: "wx" });
        if (!sameFiles([file], [fileRecord(session.directory, file.path)]))
            throw new Error("backup_bundle_invalid_file");
    }


    async restoreImport(id: string): Promise<void> {
        const session = this.getSession(id, "import");
        try {
            validateBackupBundle(session.directory, session.manifest);
            await this.restore(session.directory, session.manifest);
        } finally {
            this.remove(id);
        }
    }


    remove(id: string): void {
        const session = this.sessions.get(id);
        if (!session)
            return;

        this.sessions.delete(id);
        clearTimeout(session.expiry);
        rmSync(session.directory, { recursive: true, force: true });
    }


    private addSession(id: string, value: Omit<Session, "expiry">): void {
        const expiry = setTimeout(() => this.remove(id), 60 * 60 * 1000);
        expiry.unref();
        this.sessions.set(id, { ...value, expiry });
    }


    private getSession(id: string, kind: Session["kind"]): Session {
        const session = this.sessions.get(id);
        if (!session || session.kind !== kind)
            throw new Error("backup_bundle_missing_session");

        return session;
    }
}


function isBackupBundleManifest(value: unknown): value is BackupBundleManifest {
    if (!value || typeof value !== "object" || !("format" in value) || value.format !== 1
        || !("files" in value) || !Array.isArray(value.files) || value.files.length === 0 || value.files.length > 10_000)
        return false;

    const files = value.files;
    let total = 0;
    for (const file of files) {
        if (!file || typeof file !== "object" || typeof file.path !== "string" || !isSafeBundlePath(file.path)
            || !Number.isInteger(file.size) || file.size < 0 || file.size > 100_000_000
            || typeof file.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(file.sha256))
            return false;

        total += file.size;
    }

    return total <= 500_000_000 && files[0]?.path === "database.sqlite"
        && new Set(files.map((file) => file.path)).size === files.length;
}
