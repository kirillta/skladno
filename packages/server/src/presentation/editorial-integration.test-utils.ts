import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { once } from "node:events";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EDITORIAL_OPERATION } from "@skladno/shared";
import type { EditorialEngine } from "../application/editorial/engine/editorial-engine.js";
import type { EditorialEngineEvent } from "../application/editorial/engine/editorial-engine-event.js";
import type { EditorialEngineResolver } from "../application/editorial/engine/editorial-engine-resolver.js";
import { EDITORIAL_ENGINE_EVENT } from "../application/editorial/engine/editorial-engine-events.js";
import type { EditorialEngineRequest } from "../application/editorial/engine/editorial-engine-request.js";
import type { EditorialAssistantRequest } from "../application/editorial/engine/editorial-assistant-request.js";
import type { AssistantActionIntentVerifier } from "../application/editorial/assistant-action-intent-verifier.js";
import type { TelemetryObserver } from "../application/telemetry/telemetry-observer.js";
import { EditorialService } from "../application/editorial/editorial-service.js";
import { createLocalService } from "./server.js";
import { createApplicationServices } from "../application/create-application-services.js";
import type { ApplicationServices } from "../application/application-services.js";
import { openDatabase } from "../infrastructure/persistence/index.js";
import { createTestPersistence, type TestPersistence } from "../test-support/test-persistence.js";


export async function* createEmptyConversationStream(): AsyncIterable<EditorialEngineEvent> {
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
        yield* createEmptyConversationStream();
    }
}


export class CapabilityFixtureEngine extends FixtureEngine {
    constructor(events: EditorialEngineEvent[], private readonly capability = "generate_proposal", private readonly input?: Readonly<Record<string, string>>, private readonly requiredActiveCapability?: string) {
        super(events);
    }


    async *streamAssistant(request: EditorialAssistantRequest): AsyncIterable<EditorialEngineEvent> {
        if (this.requiredActiveCapability)
            assert.ok(request.initialActiveCapabilities?.includes(this.requiredActiveCapability));

        const selected = request.tools.find((tool) => tool.capability === this.capability);
        assert.ok(selected);
        await selected.execute(this.input ?? (this.capability === "generate_proposal" ? { operation: EDITORIAL_OPERATION.FLOW_REVISION } : {}), new AbortController().signal);
        yield { type: EDITORIAL_ENGINE_EVENT.COMPLETED, responseId: "assistant-tool-loop", text: "Proposal prepared." };
    }
}


export async function withService(engine: EditorialEngine | undefined, run: (baseUrl: string, persistence: TestPersistence, services: ApplicationServices) => Promise<void>, storeResponses = true, actionVerifier?: AssistantActionIntentVerifier, telemetry?: TelemetryObserver): Promise<void> {
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
    const editorial = new EditorialService(
        {
            articles: persistence.articles,
            sessions: persistence.editorialSessions,
            styleCorpus: persistence.styleCorpus,
            artifacts: persistence.editorialArtifacts,
            factChecks: persistence.factChecks
        },
        {
            engines,
            sessionContinuationEnabled: storeResponses
        },
        telemetry,
    );
    const services = createApplicationServices({
        stores: { articles: persistence.articles, styleCorpus: persistence.styleCorpus, assistant: persistence.assistant, artifacts: persistence.editorialArtifacts, engines, factChecks: persistence.factChecks },
        settings: {
            settings: persistence.settings,
            dateTimeFormat: { read: async () => ({ locale: "en" }) },
            models: { list: async () => [] },
            createConnectionId: () => "test-connection",
        },
        integration: { editorial, telemetry },
    });
    const service = createLocalService(config, editorial, services);
    service.listen(0, "127.0.0.1");
    await once(service, "listening");

    const address = service.address();
    assert.ok(address && typeof address !== "string");

    try {
        await run(`http://127.0.0.1:${address.port}`, persistence, services);
    } finally {
        await new Promise<void>((resolve) => service.close(() => resolve()));
        database.close();
        rmSync(directory, { recursive: true, force: true });
    }
}
