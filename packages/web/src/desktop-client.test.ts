import { describe, expect, it, vi } from "vitest";
import type { ElectronApplicationBridge } from "@skladno/shared";
import { HttpApplicationClient } from "./application-client.js";
import { createRendererApplicationClient } from "./desktop-client.js";


describe("renderer application client", () => {
    it("uses the preload client when Electron provides one", () => {
        const bridge = { streamAssistantRequest: vi.fn(), streamEditorial: vi.fn(), cancelStream: vi.fn() } as unknown as ElectronApplicationBridge;
        expect(createRendererApplicationClient({ skladno: bridge })).not.toBe(bridge);
    });

    it("keeps AbortSignal inside the renderer for Electron streams", async () => {
        const controller = new AbortController();
        const bridge = {
            streamEditorial: vi.fn(() => new Promise<void>(() => undefined)),
            cancelStream: vi.fn(),
        } as unknown as ElectronApplicationBridge;
        const client = createRendererApplicationClient({ skladno: bridge });
        const request = client.streamEditorial("article-1", { requestId: "request-1", operation: "flow_revision" }, () => undefined, controller.signal);

        controller.abort();

        await expect(request).rejects.toMatchObject({ name: "AbortError" });
        expect(bridge.streamEditorial).toHaveBeenCalledWith(expect.any(String), "article-1", { requestId: "request-1", operation: "flow_revision" }, expect.any(Function));
        expect(bridge.cancelStream).toHaveBeenCalledWith(expect.any(String));
    });

    it("keeps the browser HTTP client as the fallback", () => {
        expect(createRendererApplicationClient({})).toBeInstanceOf(HttpApplicationClient);
    });
});
