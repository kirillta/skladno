import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { once } from "node:events";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EDITORIAL_OPERATION } from "@skladno/shared";
import type { EditorialEngine } from "../application/ports/editorial-engine.js";
import type { EditorialEngineEvent } from "../application/ports/editorial-engine-event.js";
import type { EditorialEngineResolver } from "../application/ports/editorial-engine-resolver.js";
import { EDITORIAL_ENGINE_EVENT } from "../application/ports/editorial-engine-events.js";
import type { EditorialEngineRequest } from "../application/ports/editorial-engine-request.js";
import type { EditorialAssistantRequest } from "../application/ports/editorial-assistant-request.js";
import type { AssistantActionIntentVerifier } from "../application/ports/assistant-action-intent-verifier.js";
import { EditorialService } from "../application/editorial/editorial-service.js";
import { createLocalService } from "./server.js";
import { createApplicationServices } from "../application/create-application-services.js";
import { openDatabase } from "../infrastructure/persistence/index.js";
import { createTestPersistence, type TestPersistence } from "../test-support/test-persistence.js";


export async function* noConversation(): AsyncIterable<EditorialEngineEvent> {
    yield* [];
}


export class FixtureEngine implements EditorialEngine {
    readonly continuationScope = { connectionId: "connection-1", provider: "openai" as const, model: "gpt-5" };


    requests: EditorialEngineRequest[] = [];


    constructor(private readonly events: EditorialEngineEvent[]) { }


    async *stream(request: EditorialEngineRequest): AsyncIterable<EditorialEngineEvent> {
        this.requests.push(request);
        yield* this.events;
    }


    async *streamConversation(): AsyncIterable<EditorialEngineEvent> {
        yield* noConversation();
    }
}


export class CapabilityFixtureEngine extends FixtureEngine {
    constructor(events: EditorialEngineEvent[], private readonly capability = "generate_proposal", private readonly input: Readonly<Record<string, string>> = {}, private readonly requiredActiveCapability?: string) {
        super(events);
    }


    async *streamAssistant(request: EditorialAssistantRequest): AsyncIterable<EditorialEngineEvent> {
        if (this.requiredActiveCapability)
            assert.ok(request.initialActiveCapabilities?.includes(this.requiredActiveCapability));

        const selected = request.tools.find((tool) => tool.capability === this.capability);
        assert.ok(selected);
        await selected.execute(this.capability === "generate_proposal" ? { operation: EDITORIAL_OPERATION.FLOW_REVISION } : this.input, new AbortController().signal);
        yield { type: EDITORIAL_ENGINE_EVENT.COMPLETED, responseId: "assistant-tool-loop", text: "Proposal prepared." };
    }
}


export async function withService(engine: EditorialEngine | undefined, run: (baseUrl: string, persistence: TestPersistence) => Promise<void>, storeResponses = true, actionVerifier?: AssistantActionIntentVerifier): Promise<void> {
    const directory = mkdtempSync(join(tmpdir(), "skladno-editorial-"));
    const database = openDatabase(join(directory, "skladno.sqlite"));
    const persistence = createTestPersistence(database);
    const engines: EditorialEngineResolver = { resolve: () => engine, resolveAssistantActionIntentVerifier: () => actionVerifier };

    const config = {
        host: "127.0.0.1",
        port: 0,
        webOrigin: "http://localhost:5173",
        databasePath: "unused",
        aiModel: "gpt-5",
        aiSessionContinuationEnabled: storeResponses
    };
    const editorial = new EditorialService(persistence.articles, persistence.editorialSessions, persistence.styleCorpus, persistence.editorialArtifacts, engines, storeResponses, persistence.factChecks);
    const services = createApplicationServices(persistence.articles, persistence.settings, persistence.styleCorpus, persistence.assistant, persistence.editorialArtifacts, engines, { read: async () => ({ locale: "en" }) }, { list: async () => [] }, () => "test-connection", persistence.factChecks, undefined, undefined, editorial);
    const service = createLocalService(config, editorial, services);
    service.listen(0, "127.0.0.1");
    await once(service, "listening");

    const address = service.address();
    assert.ok(address && typeof address !== "string");

    try {
        await run(`http://127.0.0.1:${address.port}`, persistence);
    } finally {
        await new Promise<void>((resolve) => service.close(() => resolve()));
        database.close();
        rmSync(directory, { recursive: true, force: true });
    }
}
