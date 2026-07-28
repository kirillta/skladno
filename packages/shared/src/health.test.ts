import assert from "node:assert/strict";
import test from "node:test";

import { isHealthResponse, parseHealthResponse } from "./health.js";

test("accepts the health API contract", () => {
  const response = {
    status: "ok",
    service: "skladno-local-service",
    timestamp: "2026-07-28T00:00:00.000Z",
  };

  assert.equal(isHealthResponse(response), true);
  assert.deepEqual(parseHealthResponse(response), response);
});

test("rejects malformed health API responses", () => {
  assert.equal(isHealthResponse({ status: "ok" }), false);
  assert.throws(() => parseHealthResponse({ status: "ok" }), TypeError);
});
