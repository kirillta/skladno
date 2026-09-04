import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync } from "node:fs";

import { EDITORIAL_OPERATION, FACT_CHECK_STATUS } from "@skladno/shared";

import { createApplicationServices } from "../application/create-application-services.js";
import { EditorialService } from "../application/editorial/editorial-service.js";
import { EditorialEngineError } from "../application/ports/editorial-engine-error.js";
import type { EditorialConversationRequest } from "../application/ports/editorial-conversation-request.js";
import type { EditorialEngine } from "../application/ports/editorial-engine.js";
import type { EditorialEngineEvent } from "../application/ports/editorial-engine-event.js";
import type { EditorialEngineRequest } from "../application/ports/editorial-engine-request.js";
import type { EditorialEngineResolver } from "../application/ports/editorial-engine-resolver.js";
import { EDITORIAL_ENGINE_EVENT } from "../application/ports/editorial-engine-events.js";
import { loadServerConfig } from "../infrastructure/configuration/config.js";
import { ArticlesRepository, AssistantRepository, EditorialArtifactsRepository, EditorialSessionsRepository, FactChecksRepository, SettingsRepository, StyleCorpusRepository, openDatabase } from "../infrastructure/persistence/index.js";
import { listenForLocalService } from "../infrastructure/lifecycle/service-lifecycle.js";
import { createLocalService } from "../presentation/server.js";


class E2eFixtureEngine implements EditorialEngine {
    async *stream(request: EditorialEngineRequest, signal: AbortSignal): AsyncIterable<EditorialEngineEvent> {
        if (request.authorContext === "provider error")
            throw new EditorialEngineError("provider", "Deterministic provider failure.");

        if (request.authorContext === "wait") {
            yield { type: EDITORIAL_ENGINE_EVENT.TEXT_DELTA, delta: "Partial fixture response" };
            await new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }));
            return;
        }

        if (request.operation === EDITORIAL_OPERATION.FACT_CHECK) {
            yield {
                type: EDITORIAL_ENGINE_EVENT.TOOL_STATUS,
                tool: "claim_extraction", status: "started"
            };
            yield {
                type: EDITORIAL_ENGINE_EVENT.TOOL_STATUS,
                tool: "claim_extraction",
                status: "completed",
                claims: [{
                    claim: "The fixture claim is supported.",
                    checked: false
                }]
            };
            yield {
                type: EDITORIAL_ENGINE_EVENT.COMPLETED,
                responseId: "e2e-fact-check",
                text: "",
                factCheck: {
                    reviewedRevisionId: "",
                    createdAt: "2026-01-01T00:00:00.000Z",
                    findings: [{
                        claim: "The fixture claim is supported.",
                        status: FACT_CHECK_STATUS.SUPPORTED,
                        rationale: "Deterministic fixture evidence.",
                        uncertainty: "low",
                        sources: [{
                            url: "https://example.test/source",
                            title: "Fixture source",
                            excerpt: "Fixture evidence",
                            quality: "primary"
                        }]
                    }],
                },
            };

            return;
        }

        if (request.operation === EDITORIAL_OPERATION.TRANSLATION) {
            yield {
                type: EDITORIAL_ENGINE_EVENT.COMPLETED,
                responseId: "e2e-translation",
                text: "Texto de traducción de prueba.",
                translation: {
                    targetLanguage: request.targetLanguage ?? "Spanish",
                    protectedSpans: [],
                    title: "Fixture Article — Spanish"
                }
            };

            return;
        }

        yield { type: EDITORIAL_ENGINE_EVENT.TEXT_DELTA, delta: "Original fixture Article.\n\nImproved " };
        yield { type: EDITORIAL_ENGINE_EVENT.COMPLETED, responseId: "e2e-proposal", text: "Original fixture Article.\n\nImproved fixture note." };
    }


    async *streamConversation(request: EditorialConversationRequest, signal: AbortSignal): AsyncIterable<EditorialEngineEvent> {
        yield* this.stream({ operation: EDITORIAL_OPERATION.FLOW_REVISION, article: request.article, authorContext: request.message }, signal);
    }
}


const config = loadServerConfig();
const dataDirectory = config.databasePath.slice(0, Math.max(config.databasePath.lastIndexOf("/"), config.databasePath.lastIndexOf("\\")));
rmSync(dataDirectory, { recursive: true, force: true });
mkdirSync(dataDirectory, { recursive: true });
const database = openDatabase(config.databasePath);
const articles = new ArticlesRepository(database);
const artifacts = new EditorialArtifactsRepository(database);
const factChecks = new FactChecksRepository(database);
const settings = new SettingsRepository(database);
const sessions = new EditorialSessionsRepository(database, (articleId) => Boolean(articles.get(articleId)));
const styleCorpus = new StyleCorpusRepository(database);
const assistant = new AssistantRepository(database);
const engines: EditorialEngineResolver = { resolve: () => new E2eFixtureEngine() };

assistant.seedGreetings();
const services = createApplicationServices(articles, settings, styleCorpus, assistant, artifacts, engines, { read: async () => ({ locale: "en" }) }, { list: async () => [] }, randomUUID, factChecks);
const editorial = new EditorialService(articles, sessions, styleCorpus, artifacts, engines, false, factChecks);
const service = createLocalService(config, editorial, services);

void listenForLocalService(service, config.port, config.host);


function shutdown(): void {
    service.close(() => {
        database.close();
        rmSync(dataDirectory, { recursive: true, force: true });
    });
}


process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
