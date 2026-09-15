import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";


test("desktop shell does not install native menu chrome", () => {
    const source = readFileSync(new URL("main.ts", import.meta.url), "utf8");

    assert.match(source, /Menu\.setApplicationMenu\(null\)/);
});


test("updating bypasses the ordinary Draft-checkpoint close flow after teardown", () => {
    const source = readFileSync(new URL("main.ts", import.meta.url), "utf8");

    assert.match(source, /window\.on\("close", \(event\) => \{\s+if \(closing\)\s+return;/);
    assert.match(source, /application\.database\.close\(\);\s+closing = true;/);
});
