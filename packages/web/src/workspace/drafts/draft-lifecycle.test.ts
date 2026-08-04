import { describe, expect, it } from "vitest";
import type { Article } from "@skladno/shared";
import {
    draftPresentationState,
    hydrateDraftLifecycle,
    reduceDraftLifecycle,
    type DraftLifecycleState,
} from "./draft-lifecycle.js";


function clean(content = "Saved Article"): DraftLifecycleState {
    return {
        phase: "clean",
        content,
        baseRevisionId: "revision-1",
        generation: 0,
    };
}


function article(draft?: Article["draft"]): Article {
    return {
        id: "article-1",
        title: "Article",
        language: "en",
        currentRevisionId: "revision-1",
        currentRevision: {
            id: "revision-1",
            articleId: "article-1",
            content: "Saved Article",
            provenance: { kind: "initial" },
            createdAt: "2026-01-01T00:00:00.000Z",
        },
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        ...(draft ? { draft } : {}),
    };
}


describe("Draft lifecycle", () => {
    it("workspace.draft.checkpoint-after-idle moves local text through checkpointing without creating a Revision", () => {
        const dirty = reduceDraftLifecycle(clean(), { type: "edit", content: "Changed Article" });
        const checkpointing = reduceDraftLifecycle(dirty, { type: "checkpoint-started", generation: 1 });
        const checkpointed = reduceDraftLifecycle(checkpointing, { type: "checkpointed", generation: 1, draftVersion: 1 });

        expect(checkpointed).toEqual({
            phase: "checkpointed",
            content: "Changed Article",
            baseRevisionId: "revision-1",
            draftVersion: 1,
            generation: 1,
        });
        expect(draftPresentationState(checkpointed)).toBe("draft-saved");
    });

    it("workspace.draft.flush-before-context-change keeps the latest generation ready for an explicit checkpoint", () => {
        const dirty = reduceDraftLifecycle(clean(), { type: "edit", content: "Latest local text" });
        const checkpointing = reduceDraftLifecycle(dirty, { type: "checkpoint-started", generation: dirty.generation });

        expect(checkpointing.phase).toBe("checkpointing");
        expect(checkpointing.content).toBe("Latest local text");
        expect(checkpointing.baseRevisionId).toBe("revision-1");
    });

    it("workspace.draft.stale-completion keeps newer local text dirty when an older checkpoint completes", () => {
        const firstEdit = reduceDraftLifecycle(clean(), { type: "edit", content: "First local text" });
        const checkpointing = reduceDraftLifecycle(firstEdit, { type: "checkpoint-started", generation: firstEdit.generation });
        const secondEdit = reduceDraftLifecycle(checkpointing, { type: "edit", content: "Second local text" });
        const completed = reduceDraftLifecycle(secondEdit, { type: "checkpointed", generation: firstEdit.generation, draftVersion: 1 });

        expect(completed.phase).toBe("dirty");
        expect(completed.content).toBe("Second local text");
        expect(completed.draftVersion).toBe(1);
    });

    it("workspace.draft.promote-exact-checkpoint promotes only a checkpointed Draft into a clean Revision state", () => {
        const checkpointed = {
            ...clean("Changed Article"),
            phase: "checkpointed" as const,
            draftVersion: 3,
            generation: 2,
        };
        const promoting = reduceDraftLifecycle(checkpointed, { type: "promotion-started" });
        const promoted = reduceDraftLifecycle(promoting, { type: "promoted", revisionId: "revision-2", content: "Changed Article" });

        expect(promoting.phase).toBe("promoting");
        expect(promoted).toEqual({
            phase: "clean",
            content: "Changed Article",
            baseRevisionId: "revision-2",
            generation: 3,
        });
    });

    it("workspace.draft.conflict-recovery retains local text until the author selects a recovery path", () => {
        const conflicted = reduceDraftLifecycle(clean("Local text"), {
            type: "conflicted",
            conflict: {
                article: article({
                    articleId: "article-1",
                    content: "Persisted text",
                    baseRevisionId: "revision-1",
                    version: 2,
                    updatedAt: "2026-01-02T00:00:00.000Z",
                }),
                draft: {
                    articleId: "article-1",
                    content: "Persisted text",
                    baseRevisionId: "revision-1",
                    version: 2,
                    updatedAt: "2026-01-02T00:00:00.000Z",
                },
                localContent: "Local text",
            },
        });
        const keepLocal = reduceDraftLifecycle(conflicted, {
            type: "keep-local",
            baseRevisionId: "revision-1",
            draftVersion: 2,
        });
        const useDraft = reduceDraftLifecycle(conflicted, {
            type: "use-retained-draft",
            content: "Persisted text",
            baseRevisionId: "revision-1",
            draftVersion: 2,
        });
        const useRevision = reduceDraftLifecycle(conflicted, {
            type: "use-current-revision",
            content: "Saved Article",
            revisionId: "revision-1",
        });

        expect(conflicted.content).toBe("Local text");
        expect(keepLocal.phase).toBe("dirty");
        expect(useDraft.phase).toBe("checkpointed");
        expect(useRevision.phase).toBe("clean");
    });

    it("hydrates only a Current Draft and leaves a stale Draft recoverable outside the editing state", () => {
        const current = hydrateDraftLifecycle(article({
            articleId: "article-1",
            content: "Current Draft",
            baseRevisionId: "revision-1",
            version: 1,
            updatedAt: "2026-01-02T00:00:00.000Z",
        }));
        const stale = hydrateDraftLifecycle({
            ...article({
                articleId: "article-1",
                content: "Stale Draft",
                baseRevisionId: "revision-0",
                version: 1,
                updatedAt: "2026-01-02T00:00:00.000Z",
            }),
            currentRevisionId: "revision-1",
        });

        expect(current.phase).toBe("checkpointed");
        expect(current.content).toBe("Current Draft");
        expect(stale.phase).toBe("clean");
        expect(stale.content).toBe("Saved Article");
    });
});
