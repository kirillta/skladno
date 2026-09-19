import assert from "node:assert/strict";
import test from "node:test";
import { APPLICATION_ERROR } from "@skladno/shared";

import type { EditorialEngine } from "../application/editorial/engine/editorial-engine.js";
import { withService } from "./editorial-integration.test-utils.js";


// Product scenario: editorial-workflows.assistant-request-timeout
for (const minutes of [undefined, 3]) {
    test(`Assistant enforces ${minutes ?? 2} minute deadline and discards late translation output`, async (context) => {
        let release: () => void = () => undefined;
        let started: () => void = () => undefined;
        let providerSignal: AbortSignal | undefined;
        const pending = new Promise<void>((resolve) => {
            release = resolve;
        });
        const entered = new Promise<void>((resolve) => {
            started = resolve;
        });
        const engine: EditorialEngine = {
            async *stream(_request, signal) {
                providerSignal = signal;
                started();
                await pending;
                yield { type: "completed", responseId: "late", text: "Hola", translation: { targetLanguage: "Spanish", protectedSpans: [], title: "Prueba" } };
            },
            async *streamConversation() {
                yield* [];
            },
            async *streamAssistant(request, signal) {
                const translate = request.tools.find((tool) => tool.capability === "translate");
                assert.ok(translate);
                await translate.execute({ targetLanguage: "Spanish" }, signal);
                yield { type: "completed", responseId: "assistant", text: "Ready" };
            },
        };
        await withService(engine, async (_url, persistence, services) => {
            if (minutes !== undefined)
                persistence.settings.saveSetting("application-general", { assistantRequestTimeoutMinutes: minutes });

            const article = services.articles.createArticle({ title: "Test", content: "Hello" });
            const request = services.assistant.prepare({ kind: "new", requestId: "deadline", articleId: article.id, authorMessage: "Translate to Spanish", scope: { kind: "article", baseRevisionId: article.currentRevisionId } });
            context.mock.timers.enable({ apis: ["setTimeout"] });
            let finished = false;
            const completion = (async () => {
                for await (const event of services.assistant.stream(request, new AbortController().signal))
                    assert.notEqual(event.type, "completed");
            })().finally(() => {
                finished = true;
            });
            const failed = assert.rejects(completion, { code: APPLICATION_ERROR.ASSISTANT_REQUEST_TIMED_OUT });
            await entered;
            context.mock.timers.tick((minutes ?? 2) * 60_000 - 1);
            assert.equal(finished, false);
            context.mock.timers.tick(1);
            await failed;
            assert.equal(providerSignal?.aborted, true);
            const stored = persistence.assistant.getRequest(request.requestId);
            assert.equal(stored?.status, "failed");
            assert.equal(stored?.errorCode, APPLICATION_ERROR.ASSISTANT_REQUEST_TIMED_OUT);
            assert.equal(stored?.executions?.[0]?.status, "failed");
            release();
            await new Promise<void>((resolve) => setImmediate(resolve));
            assert.deepEqual(persistence.editorialArtifacts.listEditorialArtifacts(article.id), []);
            assert.equal(persistence.assistant.getRequest(request.requestId)?.executions?.[0]?.status, "failed");
            assert.equal(services.articles.getArticle(article.id)?.currentRevisionId, article.currentRevisionId);
            context.mock.timers.reset();
        });
    });
}
