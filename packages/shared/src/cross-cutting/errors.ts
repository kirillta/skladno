export const APPLICATION_ERROR = {
    INVALID_REQUEST: "invalid_request",
    REQUEST_TOO_LARGE: "request_too_large",
    INVALID_JSON: "invalid_json",
    ORIGIN_NOT_PERMITTED: "origin_not_permitted",
    RESOURCE_NOT_FOUND: "resource_not_found",
    ARTICLE_NOT_FOUND: "article_not_found",
    REVISION_NOT_FOUND: "revision_not_found",
    REVISION_CONFLICT: "revision_conflict",
    DRAFT_CONFLICT: "draft_conflict",
    UNSUPPORTED_PUBLISHING_PROFILE: "unsupported_publishing_profile",
    INVALID_ENVIRONMENT_VARIABLE_NAME: "invalid_environment_variable_name",
    ENVIRONMENT_VARIABLE_UNAVAILABLE: "environment_variable_unavailable",
    AI_CONNECTION_NOT_FOUND: "ai_connection_not_found",
    DUPLICATE_AI_CONNECTION: "duplicate_ai_connection",
    DUPLICATE_STYLE_CORPUS_ITEM: "duplicate_style_corpus_item",
    ACTIVE_CONNECTION_REQUIRED: "active_connection_required",
    ACTIVE_CONNECTION_REMOVAL_BLOCKED: "active_connection_removal_blocked",
    AI_CONNECTION_VERIFICATION_FAILED: "ai_connection_verification_failed",
    STYLE_CORPUS_REQUIRED: "style_corpus_required",
    TARGET_LANGUAGE_REQUIRED: "target_language_required",
    EDITORIAL_OPERATION_UNSUPPORTED: "editorial_operation_unsupported",
    EDITORIAL_CONFIGURATION_MISSING: "editorial_configuration_missing",
    EDITORIAL_PROVIDER_FAILED: "editorial_provider_failed",
    EDITORIAL_STREAM_INCOMPLETE: "editorial_stream_incomplete",
    EDITORIAL_REQUEST_FAILED: "editorial_request_failed",
    INVALID_KEY_BINDING: "invalid_key_binding",
    KEY_BINDING_CONFLICT: "key_binding_conflict",
    ASSISTANT_SKILL_UNSUPPORTED: "assistant_skill_unsupported",
    ASSISTANT_SKILL_SCOPE_INCOMPATIBLE: "assistant_skill_scope_incompatible",
    ASSISTANT_SELECTION_INVALID: "assistant_selection_invalid",
    ASSISTANT_REQUEST_CONFLICT: "assistant_request_conflict",
    ASSISTANT_RETRY_INVALID: "assistant_retry_invalid",
    ASSISTANT_COORDINATOR_FAILED: "assistant_coordinator_failed",
} as const;

export type ApplicationErrorCode = typeof APPLICATION_ERROR[keyof typeof APPLICATION_ERROR];


export interface ApplicationErrorPayload {
    code: ApplicationErrorCode;
    parameters?: Record<string, string | number>;
}


/** A renderer-safe failure returned by the local service. */
export class ApplicationClientError extends Error {
    constructor(
        public readonly code: ApplicationErrorCode,
        public readonly parameters: Record<string, string | number> | undefined,
        public readonly status: number,
    ) {
        super(code);
        this.name = "ApplicationClientError";
    }
}
