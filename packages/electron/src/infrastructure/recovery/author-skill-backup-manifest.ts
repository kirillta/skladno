import { createHash } from "node:crypto";
import { lstatSync, readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";


interface FileRecord { size: number; sha256: string }


type FileInventory = Record<string, FileRecord>;
const skillDirectories = ["skills", "skill-history"] as const;


function recordFile(path: string): FileRecord {
    const bytes = readFileSync(path);
    return { size: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") };
}


function visit(directory: string, prefix: string, files: FileInventory): void {
    for (const name of readdirSync(directory)) {
        const path = join(directory, name);
        const relative = `${prefix}/${name}`;
        const stat = lstatSync(path);
        if (stat.isDirectory())
            visit(path, relative, files);
        else if (stat.isFile())
            files[relative] = recordFile(path);
        else
            throw new Error("author_skill_backup_unsafe_file");
    }
}


function inventory(root: string): FileInventory {
    const files: FileInventory = {};
    for (const name of skillDirectories) {
        const path = join(root, name);
        if (existsSync(path)) {
            if (!lstatSync(path).isDirectory())
                throw new Error("author_skill_backup_unsafe_file");

            visit(path, name, files);
        }
    }

    return Object.fromEntries(Object.entries(files).sort(([first], [second]) => first.localeCompare(second)));
}


export function captureAuthorSkillInventory(dataDirectory: string): FileInventory {
    return inventory(dataDirectory);
}


export function writeAuthorSkillBackupManifest(snapshotPath: string, bundleDirectory: string, before: FileInventory, dataDirectory: string): void {
    const after = inventory(dataDirectory);
    const copied = inventory(bundleDirectory);
    if (JSON.stringify(before) !== JSON.stringify(after) || JSON.stringify(before) !== JSON.stringify(copied))
        throw new Error("author_skill_backup_changed");

    const manifest = { format: 1, files: { "database.sqlite": recordFile(snapshotPath), ...copied } };
    writeFileSync(join(bundleDirectory, "manifest.json"), JSON.stringify(manifest), { flag: "wx" });
}


export function validateAuthorSkillBackupManifest(snapshotPath: string, bundleDirectory: string): void {
    if (!lstatSync(bundleDirectory).isDirectory())
        throw new Error("author_skill_backup_invalid_manifest");

    const manifestPath = join(bundleDirectory, "manifest.json");
    if (!existsSync(manifestPath) || !lstatSync(manifestPath).isFile())
        throw new Error("author_skill_backup_invalid_manifest");

    const manifest: unknown = JSON.parse(readFileSync(manifestPath, "utf8"));
    if (!manifest || typeof manifest !== "object" || !("format" in manifest) || manifest.format !== 1 || !("files" in manifest))
        throw new Error("author_skill_backup_invalid_manifest");

    const actual = { "database.sqlite": recordFile(snapshotPath), ...inventory(bundleDirectory) };
    if (JSON.stringify(manifest.files) !== JSON.stringify(actual))
        throw new Error("author_skill_backup_invalid_manifest");
}
