import { EDITORIAL_OPERATION, isArticleLanguage, isPublishLimitProfileId } from "@skladno/shared";
import { EDITORIAL_CAPABILITY, EDITORIAL_CAPABILITY_INPUT, type EditorialCapabilityId } from "./editorial-capability-contracts.js";
import { editorialCapabilityDefinitions as definitions, editorialOperationClassifications, transportEvaluations } from "./editorial-capability-registry.js";


function hasExactKeys(input: Readonly<Record<string, string>>, key?: string): boolean {
    const keys = Object.keys(input);
    return key ? keys.length === 1 && keys[0] === key && Boolean(input[key]?.trim()) : keys.length === 0;
}


export function isValidatedEditorialCapabilityCall(capability: string, input: Readonly<Record<string, string>>): capability is EditorialCapabilityId {
    const definition = definitions.find((candidate) => candidate.id === capability);
    if (!definition)
        return false;

    switch (definition.input) {
        case EDITORIAL_CAPABILITY_INPUT.NONE:
            return hasExactKeys(input);
        case EDITORIAL_CAPABILITY_INPUT.PROPOSAL_OPERATION:
            return hasExactKeys(input, "operation") && (input.operation === EDITORIAL_OPERATION.THESIS_TO_NARRATIVE || input.operation === EDITORIAL_OPERATION.FLOW_REVISION);
        case EDITORIAL_CAPABILITY_INPUT.TARGET_LANGUAGE:
            return hasExactKeys(input, "targetLanguage");
        case EDITORIAL_CAPABILITY_INPUT.TITLE:
            return hasExactKeys(input, "title");
        case EDITORIAL_CAPABILITY_INPUT.LANGUAGE:
            return hasExactKeys(input, "language") && isArticleLanguage(input.language);
        case EDITORIAL_CAPABILITY_INPUT.PUBLISHING_PROFILE:
            return hasExactKeys(input, "profileId") && isPublishLimitProfileId(input.profileId);
        case EDITORIAL_CAPABILITY_INPUT.STYLE_RULES:
            return Object.keys(input).length === 1 && Object.keys(input)[0] === "rules";
        case EDITORIAL_CAPABILITY_INPUT.ARTIFACT_ID:
            return hasExactKeys(input, "artifactId");
        case EDITORIAL_CAPABILITY_INPUT.FINDING_IDS:
            return hasExactKeys(input, "findingIds") && input.findingIds.split(",").every((id) => Boolean(id.trim()));
    }
}


export function validateEditorialCapabilityCoverage(): void {
    const operations = new Set<string>();
    const capabilities = new Set<EditorialCapabilityId>();
    for (const entry of editorialOperationClassifications) {
        if (operations.has(entry.id))
            throw new Error(`Duplicate Editorial operation classification: ${entry.id}`);

        operations.add(entry.id);
        if (entry.capability) {
            if (capabilities.has(entry.capability))
                throw new Error(`Capability has more than one Editorial operation: ${entry.capability}`);

            capabilities.add(entry.capability);
        }
    }

    for (const definition of definitions)
        if (!capabilities.has(definition.id))
            throw new Error(`Capability has no Editorial operation classification: ${definition.id}`);

    for (const evaluation of transportEvaluations) {
        if (!evaluation.operation && !evaluation.outsideAssistantAuthority)
            throw new Error("Transport evaluation needs an operation or outside-authority reason.");

        if (evaluation.operation && !operations.has(evaluation.operation))
            throw new Error(`Transport maps to an unknown Editorial operation: ${evaluation.operation}`);
    }
}


export function capabilityForEditorialOperation(operation: import("@skladno/shared").EditorialOperation): Extract<EditorialCapabilityId, "generate_proposal" | "fact_check" | "style_review" | "translate"> {
    switch (operation) {
        case EDITORIAL_OPERATION.FACT_CHECK:
            return EDITORIAL_CAPABILITY.FACT_CHECK;
        case EDITORIAL_OPERATION.STYLE_REVIEW:
            return EDITORIAL_CAPABILITY.STYLE_REVIEW;
        case EDITORIAL_OPERATION.TRANSLATION:
            return EDITORIAL_CAPABILITY.TRANSLATE;
        default:
            return EDITORIAL_CAPABILITY.GENERATE_PROPOSAL;
    }
}


export function activityForEditorialOperation(operation: import("@skladno/shared").EditorialOperation): string {
    return definitions.find((definition) => definition.id === capabilityForEditorialOperation(operation))?.activity ?? "Preparing editorial work.";
}
