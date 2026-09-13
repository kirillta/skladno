import assert from "node:assert/strict";
import test from "node:test";
import { safeWindowBounds } from "./window-state.js";


const display = { x: 0, y: 0, width: 1920, height: 1080 };


test("desktop window restores valid bounds and recenters off-screen state", () => {
    const valid = { x: 50, y: 60, width: 1200, height: 800 };
    assert.deepEqual(safeWindowBounds(valid, [display]), valid);
    assert.deepEqual(safeWindowBounds({ x: 5000, y: 5000, width: 1200, height: 800 }, [display]), {
        x: 240,
        y: 90,
        width: 1440,
        height: 900,
    });
});
