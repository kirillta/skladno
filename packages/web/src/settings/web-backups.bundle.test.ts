import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import { chooseBackupFolder, listWebBackups, restoreWebBackup, saveWebBackup } from "./web-backups.js";


// Product scenarios: settings.backup-policy-human-reviewed, settings.browser-skill-backup-restore


class MemoryFolder {
    readonly name = "backups";


    readonly files = new Map<string, Blob>();


    readonly directories = new Map<string, MemoryFolder>();


    async queryPermission(): Promise<PermissionState> {
        return "granted";
    }


    async requestPermission(): Promise<PermissionState> {
        return "granted";
    }


    async getFileHandle(name: string, options?: { create?: boolean }) {
        if (!options?.create && !this.files.has(name))
            throw new Error("missing file");

        return {
            getFile: async () => this.files.get(name)!,
            createWritable: async () => ({
                write: async (file: Blob) => {
                    this.files.set(name, file);
                },
                close: async () => undefined,
            }),
        };
    }


    async getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<MemoryFolder> {
        let directory = this.directories.get(name);
        if (!directory && options?.create) {
            directory = new MemoryFolder();
            this.directories.set(name, directory);
        }

        if (!directory)
            throw new Error("missing directory");

        return directory;
    }


    async *values(): AsyncIterable<{ kind: string; name: string }> {
        for (const name of this.files.keys())
            yield { kind: "file", name };

        for (const name of this.directories.keys())
            yield { kind: "directory", name };
    }


    async removeEntry(name: string): Promise<void> {
        this.files.delete(name);
        this.directories.delete(name);
    }
}


describe("browser Skill backup bundle", () => {
    it("saves and restores the database with Skill files through a folder handle", async () => {
        const folder = new MemoryFolder();
        vi.stubGlobal("showDirectoryPicker", async () => folder);
        await chooseBackupFolder();

        const contents = [new Blob(["database"]), new Blob(["skill"]), new Blob(["history"])];
        const paths = ["database.sqlite", "skills/clarity/SKILL.md", "skill-history/clarity/revision-1/SKILL.md"];
        const manifest = { format: 1 as const, files: paths.map((path, index) => ({
            path, size: contents[index]!.size,
            sha256: createHash("sha256").update(["database", "skill", "history"][index]!).digest("hex"),
        })) };
        const received: string[] = [];
        const client = {
            createBackupExport: async () => ({ id: "export", manifest }),
            readBackupExport: async (_id: string, index: number) => contents[index]!,
            removeBackupExport: async () => undefined,
            beginBackupImport: async () => ({ id: "import" }),
            writeBackupImport: async (_id: string, _index: number, file: Blob) => {
                received.push(await file.text());
            },
            restoreBackupImport: async () => undefined,
            removeBackupImport: async () => undefined,
        };

        const name = await saveWebBackup(client, "manual", { schedule: "off", retention: { mode: "unlimited" } });
        expect(name.endsWith(".skladno")).toBe(true);
        expect(await listWebBackups()).toContain(name);
        await restoreWebBackup(client, name);
        expect(received).toEqual(["database", "skill", "history"]);

        folder.files.set("legacy.sqlite", new Blob(["legacy database"]));
        folder.directories.set("incomplete.skladno", new MemoryFolder());
        expect(await listWebBackups()).toContain("legacy.sqlite");
        expect(await listWebBackups()).not.toContain("incomplete.skladno");
        const restoreLegacy = vi.fn().mockResolvedValue(undefined);
        await restoreWebBackup({ restoreBackup: restoreLegacy }, "legacy.sqlite");
        expect(await restoreLegacy.mock.calls[0]![0].text()).toBe("legacy database");
        vi.unstubAllGlobals();
    });
});
