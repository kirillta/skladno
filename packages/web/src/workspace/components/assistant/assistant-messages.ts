import type { AssistantResponseKind, BuiltInSkillId } from "@skladno/shared";


export const skillMessages: Record<BuiltInSkillId, "assistant.skill.talkingPoints.label" | "assistant.skill.narrativeDraft.label" | "assistant.skill.flowAndClarity.label" | "assistant.skill.factChecking.label" | "assistant.skill.styleReview.label" | "assistant.skill.translation.label"> = {
    talking_points: "assistant.skill.talkingPoints.label",
    narrative_draft: "assistant.skill.narrativeDraft.label",
    flow_and_clarity: "assistant.skill.flowAndClarity.label",
    fact_checking: "assistant.skill.factChecking.label",
    style_review: "assistant.skill.styleReview.label",
    translation: "assistant.skill.translation.label",
};


export const responseMessages: Record<AssistantResponseKind, "assistant.response.conversation" | "assistant.response.skill" | "assistant.response.proposal" | "assistant.response.findings" | "assistant.response.proposalAndFindings" | "assistant.response.translation" | "assistant.requestCancelled" | "assistant.requestFailed"> = {
    editorial_conversation: "assistant.response.conversation",
    skill_response: "assistant.response.skill",
    proposal_prepared: "assistant.response.proposal",
    findings_prepared: "assistant.response.findings",
    proposal_and_findings_prepared: "assistant.response.proposalAndFindings",
    translation_proposal_prepared: "assistant.response.translation",
    request_cancelled: "assistant.requestCancelled",
    request_failed: "assistant.requestFailed",
};


export function selectionPreview(selection: string): string {
    const normalized = selection.replace(/\s+/g, " ").trim();

    return normalized.length > 20 ? `${normalized.slice(0, 20)}…` : normalized;
}
