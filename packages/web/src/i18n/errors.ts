import type { ApplicationErrorCode } from "@skladno/shared";
import type { MessageId } from "./messages.js";

const errorMessages: Record<ApplicationErrorCode, MessageId> = {
    invalid_request: "errors.invalidRequest", request_too_large: "errors.requestTooLarge", invalid_json: "errors.invalidJson", origin_not_permitted: "errors.originNotPermitted", resource_not_found: "errors.resourceNotFound", article_not_found: "errors.articleNotFound", revision_not_found: "errors.revisionNotFound", revision_conflict: "errors.revisionConflict", unsupported_publishing_profile: "errors.unsupportedPublishingProfile", invalid_workflow_stage: "errors.invalidWorkflowStage", invalid_environment_variable_name: "errors.invalidEnvironmentVariableName", environment_variable_unavailable: "errors.environmentVariableUnavailable", openai_connection_not_found: "errors.openaiConnectionNotFound", active_connection_required: "errors.activeConnectionRequired", active_connection_removal_blocked: "errors.activeConnectionRemovalBlocked", openai_connection_verification_failed: "errors.openaiConnectionVerificationFailed", style_corpus_required: "errors.styleCorpusRequired", target_language_required: "errors.targetLanguageRequired", editorial_operation_unsupported: "errors.editorialOperationUnsupported", editorial_configuration_missing: "errors.editorialConfigurationMissing", editorial_provider_failed: "errors.editorialProviderFailed", editorial_stream_incomplete: "errors.editorialStreamIncomplete", editorial_request_failed: "errors.editorialRequestFailed",
};

export function errorMessageId(code: string): MessageId {
    return errorMessages[code as ApplicationErrorCode] ?? "errors.generic";
}
