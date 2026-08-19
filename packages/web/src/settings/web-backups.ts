import type { BackupPolicy } from "@skladno/shared";


interface BackupDirectoryHandle {
    name: string;
    queryPermission(options: { mode: "readwrite" }): Promise<PermissionState>;
    requestPermission(options: { mode: "readwrite" }): Promise<PermissionState>;
    getFileHandle(name: string, options: { create: true }): Promise<{ createWritable(): Promise<{ write(data: Blob): Promise<void>; close(): Promise<void> }> }>;
    values(): AsyncIterable<{ kind: string; name: string }>;
    removeEntry(name: string): Promise<void>;
}


interface BackupClient {
    createBackup?: () => Promise<Blob>;
}


type BackupKind = "manual" | "automatic";
const databaseName = "skladno-web-backups";
const storeName = "settings";
const folderKey = "folder";
const automaticBackupKey = "last-automatic-backup";
let automaticBackupInProgressFor: string | undefined;
let selectedFolder: BackupDirectoryHandle | undefined;


function filename(kind: BackupKind): string {
    return `skladno-${kind}-${new Date().toISOString().replaceAll(/[:.]/g, "-")}.sqlite`;
}


function picker(): (() => Promise<BackupDirectoryHandle>) | undefined {
    const choose = (window as Window & { showDirectoryPicker?: () => Promise<BackupDirectoryHandle> }).showDirectoryPicker;
    return choose ? () => choose.call(window) : undefined;
}


function openStore(mode: IDBTransactionMode): Promise<IDBObjectStore> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(databaseName, 1);
        request.onupgradeneeded = () => request.result.createObjectStore(storeName);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result.transaction(storeName, mode).objectStore(storeName));
    });
}


async function readFolder(): Promise<BackupDirectoryHandle | undefined> {
    if (selectedFolder)
        return selectedFolder;

    const store = await openStore("readonly");
    return new Promise((resolve, reject) => {
        const request = store.get(folderKey);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result as BackupDirectoryHandle | undefined);
    });
}


async function saveFolder(folder: BackupDirectoryHandle): Promise<void> {
    const store = await openStore("readwrite");
    await new Promise<void>((resolve, reject) => {
        const request = store.put(folder, folderKey);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
    });
}


async function writableFolder(requestPermission: boolean): Promise<BackupDirectoryHandle> {
    const folder = await readFolder();
    if (!folder)
        throw new Error("Choose a backup folder first.");

    const permission = requestPermission ? await folder.requestPermission({ mode: "readwrite" }) : await folder.queryPermission({ mode: "readwrite" });
    if (permission !== "granted")
        throw new Error("Backup folder permission is not available.");

    return folder;
}


async function retainAutomaticBackups(folder: BackupDirectoryHandle, policy: BackupPolicy): Promise<void> {
    if (policy.retention.mode === "unlimited")
        return;

    const files: string[] = [];
    for await (const entry of folder.values()) {
        if (entry.kind === "file" && entry.name.startsWith("skladno-automatic-") && entry.name.endsWith(".sqlite"))
            files.push(entry.name);
    }

    for (const name of files.sort().reverse().slice(policy.retention.count))
        await folder.removeEntry(name);
}


export async function chooseBackupFolder(): Promise<string> {
    const choose = picker();
    if (!choose)
        throw new Error("This browser cannot choose a backup folder.");

    const folder = await choose();
    selectedFolder = folder;
    try {
        await saveFolder(folder);
    } catch {
        // ponytail: session-only selection when handle persistence is unavailable; add alternate storage only if supported browsers need it.
    }

    return folder.name;
}


export async function selectedBackupFolderName(): Promise<string | undefined> {
    return (await readFolder())?.name;
}


export async function saveWebBackup(client: BackupClient, kind: BackupKind, policy: BackupPolicy, requestPermission = true): Promise<string> {
    if (!client.createBackup)
        throw new Error("Web backups are unavailable in this client.");

    const folder = await writableFolder(requestPermission);
    const name = filename(kind);
    const file = await folder.getFileHandle(name, { create: true });
    const writer = await file.createWritable();
    try {
        await writer.write(await client.createBackup());
    } finally {
        await writer.close();
    }

    await retainAutomaticBackups(folder, policy);
    return name;
}


export async function saveScheduledWebBackup(client: BackupClient, policy: BackupPolicy): Promise<void> {
    const today = new Date().toISOString().slice(0, 10);
    if (policy.schedule !== "daily" || automaticBackupInProgressFor === today || localStorage.getItem(automaticBackupKey) === today)
        return;

    automaticBackupInProgressFor = today;
    try {
        await saveWebBackup(client, "automatic", policy, false);
    } catch (error) {
        automaticBackupInProgressFor = undefined;
        throw error;
    }

    localStorage.setItem(automaticBackupKey, today);
}
