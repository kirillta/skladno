import assert from "node:assert/strict";
import test from "node:test";

import forgeConfig from "../packages/electron/forge.config.js";


test("the Debian launcher uses Electron's packaged executable", () => {
    const debMaker = forgeConfig.makers.find(({ name }) => name === "@electron-forge/maker-deb");

    assert.equal(debMaker?.config.options.bin, forgeConfig.packagerConfig.executableName);
});
