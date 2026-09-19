import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase } from "./database.js";
import { createTestPersistence, type TestPersistence } from "../../test-support/test-persistence.js";


export async function withRepository(run: (repositories: TestPersistence, close: () => void, database: ReturnType<typeof openDatabase>) => void | Promise<void>): Promise<void> {
    const directory = mkdtempSync(join(tmpdir(), "skladno-persistence-"));
    const database = openDatabase(join(directory, "skladno.sqlite"));
    try {
        await run(createTestPersistence(database), () => database.close(), database);
    } finally {
        database.close();
        rmSync(directory, { recursive: true, force: true });
    }
}
