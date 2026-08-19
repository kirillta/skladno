import assert from "node:assert/strict";
import test from "node:test";

import { isThemePreference, resolveTheme } from "./settings.js";


test("theme preferences validate and resolve the device preference", () => {
    assert.equal(isThemePreference("system"), true);
    assert.equal(isThemePreference("high-contrast"), false);
    assert.equal(resolveTheme("system", "dark"), "dark");
    assert.equal(resolveTheme("light", "dark"), "light");
});
