import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { electronMessagesFor } from "@skladno/shared";


// product: cross-cutting.electron-native-copy-catalogued
test("Electron native dialogs use the interface locale catalog", () => {
    const mainSource = readFileSync(new URL("main.ts", import.meta.url), "utf8");
    const messages = electronMessagesFor("en");

    assert.doesNotMatch(mainSource, /Draft checkpoint failed|Skladno could not start|Skladno could not close cleanly/);
    assert.equal(messages["electron.draftCheckpointFailed.return"], "Return to Article");
    assert.equal(messages["electron.startFailed.title"], "Skladno could not start");
});
