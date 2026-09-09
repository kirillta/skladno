import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { parse, join } from "node:path";
import test from "node:test";
import { setup } from "./desktop-settings.test-utils.js";

// Product scenario: settings.delete-local-data

test("deleting local data closes first, preserves other files, and exits", async () => {
    const fixture = setup(0);
    try {
        assert.deepEqual(await fixture.invoke(), { ok: true, value: undefined });
        assert.equal(fixture.closed(), true);
        assert.equal(fixture.quit(), true);
        assert.equal(existsSync(fixture.dataDirectory), false);
        assert.equal(readFileSync(join(fixture.root, "unrelated.txt"), "utf8"), "keep");
    } finally {
        fixture.cleanup();
    }
});

test("cancelling backup restoration leaves local data unchanged", async () => {
    const fixture = setup(1);
    try {
        assert.deepEqual(await fixture.invokeRestore(), { ok: true, value: undefined });
        assert.equal(fixture.closed(), false);
        assert.equal(fixture.quit(), false);
        assert.equal(readFileSync(join(fixture.dataDirectory, "skladno.sqlite"), "utf8"), "author data");
    } finally {
        fixture.cleanup();
    }
});

test("backup and deletion creates an isolated snapshot before removal", async () => {
    const fixture = setup(0, true);
    try {
        assert.deepEqual(await fixture.invoke(), { ok: true, value: undefined });
        assert.equal(fixture.closed(), true);
        assert.equal(existsSync(fixture.dataDirectory), false);
        assert.equal(fixture.checkboxLabel(), "Create a backup before deletion");
        assert.equal(fixture.checkboxInitiallyChecked(), true);
        assert.equal(readdirSync(fixture.backupDirectory).filter((file) => file.endsWith(".sqlite")).length, 1);
    } finally {
        fixture.cleanup();
    }
});

test("deletion always shows an unchecked backup checkbox without a backup folder", async () => {
    const fixture = setup(0, false, false, undefined, false);
    try {
        assert.deepEqual(await fixture.invoke(), { ok: true, value: undefined });
        assert.equal(fixture.checkboxLabel(), "Create a backup before deletion");
        assert.equal(fixture.checkboxInitiallyChecked(), false);
    } finally {
        fixture.cleanup();
    }
});

test("cancelling deletion leaves the isolated local data directory unchanged", async () => {
    const fixture = setup(1);
    try {
        assert.deepEqual(await fixture.invoke(), { ok: true, value: undefined });
        assert.equal(fixture.closed(), false);
        assert.equal(fixture.quit(), false);
        assert.equal(readFileSync(join(fixture.dataDirectory, "skladno.sqlite"), "utf8"), "author data");
    } finally {
        fixture.cleanup();
    }
});

test("a failed backup does not close or delete local data", async () => {
    const fixture = setup(0, true, true);
    try {
        assert.deepEqual(await fixture.invoke(), { ok: false, error: "editorial_request_failed" });
        assert.equal(fixture.closed(), false);
        assert.equal(fixture.quit(), false);
        assert.equal(readFileSync(join(fixture.dataDirectory, "skladno.sqlite"), "utf8"), "author data");
        const [event] = fixture.telemetry();
        if (!event || event.kind !== "backup_finished")
            assert.fail("Expected a backup telemetry event.");

        assert.equal(event.outcome, "failed");
    } finally {
        fixture.cleanup();
    }
});

test("requesting a backup without a backup folder does not delete local data", async () => {
    const fixture = setup(0, true, false, undefined, false);
    try {
        assert.deepEqual(await fixture.invoke(), { ok: false, error: "editorial_request_failed" });
        assert.equal(fixture.closed(), false);
        assert.equal(readFileSync(join(fixture.dataDirectory, "skladno.sqlite"), "utf8"), "author data");
    } finally {
        fixture.cleanup();
    }
});

test("a filesystem root is rejected without closing the application", async () => {
    const fixture = setup(0, false, false, parse(process.cwd()).root);
    try {
        assert.deepEqual(await fixture.invoke(), { ok: false, error: "invalid_request" });
        assert.equal(fixture.closed(), false);
        assert.equal(fixture.quit(), false);
        assert.equal(readFileSync(join(fixture.dataDirectory, "skladno.sqlite"), "utf8"), "author data");
    } finally {
        fixture.cleanup();
    }
});
