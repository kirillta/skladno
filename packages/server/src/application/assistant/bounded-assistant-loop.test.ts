import assert from "node:assert/strict";
import test from "node:test";

import { BoundedAssistantLoop, ASSISTANT_LOOP_STEP_LIMIT, type AssistantLoopModelStep } from "./bounded-assistant-loop.js";
import { EDITORIAL_CAPABILITY } from "./editorial-capability-catalog.js";
import { EDITORIAL_ENGINE_ERROR } from "../ports/editorial-engine-errors.js";
import { EditorialEngineError } from "../ports/editorial-engine-error.js";


function model(steps: AssistantLoopModelStep[]) {
    const completion: AssistantLoopModelStep = { kind: "completed", text: "done" };
    return { next: async () => steps.shift() ?? completion };
}


test("the bounded Assistant loop stages validated calls until completion", async () => {
    const calls: string[] = [];
    const loop = new BoundedAssistantLoop(model([
        { kind: "tool-call", call: { capability: EDITORIAL_CAPABILITY.INSPECT_ARTICLE, input: {} } },
        { kind: "tool-call", call: { capability: EDITORIAL_CAPABILITY.FACT_CHECK, input: {} } },
        { kind: "completed", text: "Facts are ready." },
    ]), { execute: async (call) => {
        calls.push(call.capability);
        return { capability: call.capability };
    } });

    assert.deepEqual(await loop.run(new AbortController().signal), {
        kind: "completed",
        text: "Facts are ready.",
        staged: [{ capability: EDITORIAL_CAPABILITY.INSPECT_ARTICLE }, { capability: EDITORIAL_CAPABILITY.FACT_CHECK }],
    });
    assert.deepEqual(calls, [EDITORIAL_CAPABILITY.INSPECT_ARTICLE, EDITORIAL_CAPABILITY.FACT_CHECK]);
});


test("the loop stops after six model steps and retries only a read once", async () => {
    let attempts = 0;
    const steps: AssistantLoopModelStep[] = Array.from(
        { length: ASSISTANT_LOOP_STEP_LIMIT },
        () => ({ kind: "tool-call", call: { capability: EDITORIAL_CAPABILITY.INSPECT_REVISIONS, input: {} } }),
    );
    const loop = new BoundedAssistantLoop(model(steps), {
        execute: async () => {
            attempts += 1;
            if (attempts === 1)
                throw new EditorialEngineError(EDITORIAL_ENGINE_ERROR.NETWORK, "temporary");

            return "ok";
        },
    });

    assert.deepEqual(await loop.run(new AbortController().signal), { kind: "exhausted" });
    assert.equal(attempts, ASSISTANT_LOOP_STEP_LIMIT + 1);
});


test("the loop does not retry artifact-producing or non-transient failures", async () => {
    let attempts = 0;
    const loop = new BoundedAssistantLoop(model([
        { kind: "tool-call", call: { capability: EDITORIAL_CAPABILITY.FACT_CHECK, input: {} } },
    ]), {
        execute: async () => {
            attempts += 1;
            throw new EditorialEngineError(EDITORIAL_ENGINE_ERROR.NETWORK, "temporary");
        },
    });

    assert.deepEqual(await loop.run(new AbortController().signal), { kind: "failed" });
    assert.equal(attempts, 1);
});


test("the loop discards staged work on cancellation or an invalid call", async () => {
    const controller = new AbortController();
    controller.abort();
    const cancelled = new BoundedAssistantLoop(model([]), { execute: async () => "never" });
    assert.deepEqual(await cancelled.run(controller.signal), { kind: "cancelled" });

    const invalid = new BoundedAssistantLoop(model([{ kind: "tool-call", call: { capability: "not_registered", input: {} } }]), { execute: async () => "never" });
    assert.deepEqual(await invalid.run(new AbortController().signal), { kind: "invalid-call" });

    const malformed = new BoundedAssistantLoop(model([{ kind: "tool-call", call: { capability: EDITORIAL_CAPABILITY.FACT_CHECK, input: { url: "https://example.com" } } }]), { execute: async () => "never" });

    assert.deepEqual(await malformed.run(new AbortController().signal), { kind: "invalid-call" });
});
