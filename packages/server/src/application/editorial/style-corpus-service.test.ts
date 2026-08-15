import assert from "node:assert/strict";
import test from "node:test";
import type { CreateStyleCorpusItemInput, StyleCorpus } from "@skladno/shared";

import { StyleCorpusService } from "./style-corpus-service.js";

// Product scenarios: history-and-publishing.style-corpus-local

test("generates a source name only when the Author leaves it blank", async () => {
    const inputs: CreateStyleCorpusItemInput[] = [];
    const corpus = { items: [], rules: "", status: "empty" } as StyleCorpus;
    const store = {
        get: () => corpus,
        add: (input: CreateStyleCorpusItemInput & { name: string }) => {
            inputs.push(input);
            return corpus;
        },
        setIncluded: () => corpus,
        setRules: () => corpus,
        rebuild: () => corpus,
        getArticleRules: () => "",
        setArticleRules: () => "",
        remove: () => undefined,
    };
    const service = new StyleCorpusService(store, {
        resolve: () => undefined,
        resolveSourceNameGenerator: () => ({ generate: async () => "Generated source" }),
    });

    await service.add({ name: "  Manual source  ", content: "Text" }, new AbortController().signal);
    await service.add({ content: "Text" }, new AbortController().signal);

    assert.deepEqual(inputs, [
        { name: "Manual source", content: "Text" },
        { name: "Generated source", content: "Text" },
    ]);
});
