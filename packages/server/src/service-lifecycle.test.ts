import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";

import { closeLocalService, listenForLocalService } from "./service-lifecycle.js";


test("local service shutdown releases its listener", async () => {
    const service = createServer();

    await listenForLocalService(service, 0, "127.0.0.1");
    assert.equal(service.listening, true);

    await closeLocalService(service);

    assert.equal(service.listening, false);
});


test("local service startup rejects a port already in use", async () => {
    const first = createServer();
    const second = createServer();

    await listenForLocalService(first, 0, "127.0.0.1");
    const address = first.address();
    assert.ok(address && typeof address !== "string");

    try {
        await assert.rejects(
            listenForLocalService(second, address.port, "127.0.0.1"),
            (error: NodeJS.ErrnoException) => error.code === "EADDRINUSE",
        );
    } finally {
        await closeLocalService(first);
    }
});
