import { describe, expect, it } from "vitest";
import type { EditorialWorkspaceClient } from "@skladno/shared";
import { HttpApplicationClient } from "./application-client.js";
import { createRendererApplicationClient } from "./desktop-client.js";


describe("renderer application client", () => {
    it("uses the preload client when Electron provides one", () => {
        const client = {} as EditorialWorkspaceClient;
        expect(createRendererApplicationClient({ skladno: client })).toBe(client);
    });

    it("keeps the browser HTTP client as the fallback", () => {
        expect(createRendererApplicationClient({})).toBeInstanceOf(HttpApplicationClient);
    });
});
