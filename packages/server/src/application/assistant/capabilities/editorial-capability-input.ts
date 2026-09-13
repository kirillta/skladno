export const EDITORIAL_CAPABILITY_INPUT = {
    NONE: "none",
    PROPOSAL_OPERATION: "proposal-operation",
    TARGET_LANGUAGE: "target-language",
    TITLE: "title",
    LANGUAGE: "language",
    PUBLISHING_PROFILE: "publishing-profile",
    STYLE_RULES: "style-rules",
    ARTIFACT_ID: "artifact-id",
    FINDING_IDS: "finding-ids"
} as const;

export type EditorialCapabilityInput = typeof EDITORIAL_CAPABILITY_INPUT[keyof typeof EDITORIAL_CAPABILITY_INPUT];
