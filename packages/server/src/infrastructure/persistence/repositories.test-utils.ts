import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase } from "./database.js";
import { createTestPersistence, type TestPersistence } from "../../test-support/test-persistence.js";


export function withRepository(run: (repositories: TestPersistence, close: () => void, database: ReturnType<typeof openDatabase>) => void): void {
    const directory = mkdtempSync(join(tmpdir(), "skladno-persistence-"));
    const database = openDatabase(join(directory, "skladno.sqlite"));
    try {
        run(createTestPersistence(database), () => database.close(), database);
    } finally {
        database.close();
        rmSync(directory, { recursive: true, force: true });
    }
}
