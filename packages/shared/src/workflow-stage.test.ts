import assert from "node:assert/strict";
import test from "node:test";

import { ARTICLE_LANGUAGE, WORKFLOW_STAGE, isArticleLanguage, isWorkflowStage, workflowStages } from "./index.js";

test("workflow stages are ordered and validate only the supported values", () => {
    assert.deepEqual(workflowStages, [
        WORKFLOW_STAGE.TALKING_POINTS,
        WORKFLOW_STAGE.NARRATIVE_DRAFT,
        WORKFLOW_STAGE.AUTHOR_EDITING,
        WORKFLOW_STAGE.FLOW_AND_CLARITY,
        WORKFLOW_STAGE.FACT_CHECKING,
        WORKFLOW_STAGE.STYLE_REVIEW,
        WORKFLOW_STAGE.TRANSLATION,
        WORKFLOW_STAGE.PUBLICATION_PREVIEW,
    ]);

    for (const stage of workflowStages)
        assert.equal(isWorkflowStage(stage), true);

    assert.equal(isWorkflowStage("flow"), false);
    assert.equal(isWorkflowStage(undefined), false);
});


test("Article language IDs accept the supported stable values", () => {
    for (const language of Object.values(ARTICLE_LANGUAGE))
        assert.equal(isArticleLanguage(language), true);

    assert.equal(isArticleLanguage("en"), true);
    assert.equal(isArticleLanguage("English"), false);
});
