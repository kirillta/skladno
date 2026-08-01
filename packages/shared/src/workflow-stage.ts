export const WORKFLOW_STAGE = {
    TALKING_POINTS: "talking_points",
    NARRATIVE_DRAFT: "narrative_draft",
    AUTHOR_EDITING: "author_editing",
    FLOW_AND_CLARITY: "flow_and_clarity",
    FACT_CHECKING: "fact_checking",
    STYLE_REVIEW: "style_review",
    TRANSLATION: "translation",
    PUBLICATION_PREVIEW: "publication_preview",
} as const;

export type WorkflowStage = typeof WORKFLOW_STAGE[keyof typeof WORKFLOW_STAGE];

export const workflowStages: readonly WorkflowStage[] = [
    WORKFLOW_STAGE.TALKING_POINTS,
    WORKFLOW_STAGE.NARRATIVE_DRAFT,
    WORKFLOW_STAGE.AUTHOR_EDITING,
    WORKFLOW_STAGE.FLOW_AND_CLARITY,
    WORKFLOW_STAGE.FACT_CHECKING,
    WORKFLOW_STAGE.STYLE_REVIEW,
    WORKFLOW_STAGE.TRANSLATION,
    WORKFLOW_STAGE.PUBLICATION_PREVIEW,
];

export function isWorkflowStage(value: unknown): value is WorkflowStage {
    return typeof value === "string" && workflowStages.includes(value as WorkflowStage);
}
