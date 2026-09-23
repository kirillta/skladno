import type { AssistantCapabilityExecution, AssistantRequest, AssistantRequestScope, AssistantRequestStatus, AssistantSkillSource } from "@skladno/shared";

import type { SqliteDatabase } from "../database.js";
import { type Row } from "./repository-utils.js";

const requestStatuses: readonly AssistantRequestStatus[] = ["pending", "running", "completed", "failed", "cancelled"];
const skillSources: readonly AssistantSkillSource[] = ["explicit", "inferred"];


function readAssistantRequestMetadata(row: Row): { scope: AssistantRequestScope; status: AssistantRequestStatus } {
    const scope = JSON.parse(String(row.scope_json)) as AssistantRequestScope;
    const status = String(row.status) as AssistantRequestStatus;
    if (!requestStatuses.includes(status) || !scope || (scope.kind !== "article" && scope.kind !== "selection"))
        throw new Error("Invalid persisted assistant request.");

    return { scope, status };
}


function readAssistantRequestSkills(row: Row): { explicitSkillId?: string; resolvedSkillId?: string; skillSource?: AssistantSkillSource } {
    const explicitSkillId = readAssistantSkillId(row, "explicit_skill_id");
    const resolvedSkillId = readAssistantSkillId(row, "resolved_skill_id");
    const skillSource = row.skill_source === null ? undefined : String(row.skill_source) as AssistantSkillSource;
    if (skillSource && !skillSources.includes(skillSource))
        throw new Error("Invalid persisted assistant request.");

    return { ...(explicitSkillId ? { explicitSkillId } : {}), ...(resolvedSkillId ? { resolvedSkillId } : {}), ...(skillSource ? { skillSource } : {}) };
}


function readAssistantSkillId(row: Row, field: "explicit_skill_id" | "resolved_skill_id"): string | undefined {
    return row[field] === null ? undefined : String(row[field]);
}


function readAssistantAuthorMessage(database: SqliteDatabase, requestId: string): Row {
    const authorMessage = database.prepare("SELECT content, skill_offset FROM assistant_messages WHERE request_id = ? AND role = 'author' ORDER BY created_at, id LIMIT 1").get(requestId) as Row | undefined;
    if (!authorMessage || typeof authorMessage.content !== "string")
        throw new Error("Missing persisted assistant author message.");

    return authorMessage;
}


function readAssistantCapabilityExecutions(database: SqliteDatabase, requestId: string): AssistantCapabilityExecution[] {
    return (database.prepare("SELECT capability_name, status, base_revision_id, started_at, completed_at FROM assistant_capability_executions WHERE request_id = ? ORDER BY id").all(requestId) as Row[])
        .map((execution): AssistantCapabilityExecution => ({
            capability: String(execution.capability_name),
            status: String(execution.status) as AssistantCapabilityExecution["status"],
            requestId,
            baseRevisionId: String(execution.base_revision_id),
            startedAt: String(execution.started_at),
            ...(execution.completed_at === null ? {} : { completedAt: String(execution.completed_at) }),
        }));
}


function getCapabilityExecutionField(row: Row, status: AssistantRequestStatus): Partial<Pick<AssistantRequest, "execution">> {
    if (row.capability_name === null || row.capability_name === undefined)
        return {};

    const capability = String(row.capability_name);
    return { execution: { capability, status, requestId: String(row.id), baseRevisionId: String(row.base_revision_id) } };
}


function getAssistantRequestDetails(row: Row, authorMessage: Row, executions: AssistantCapabilityExecution[], status: AssistantRequestStatus): Partial<AssistantRequest> {
    return {
        ...(row.retry_of_request_id === null ? {} : { retryOfRequestId: String(row.retry_of_request_id) }),
        ...(row.error_code === null ? {} : { errorCode: String(row.error_code) }),
        ...(authorMessage.skill_offset === null || authorMessage.skill_offset === undefined ? {} : { skillOffset: Number(authorMessage.skill_offset) }),
        ...(row.target_language === null || row.target_language === undefined ? {} : { targetLanguage: String(row.target_language) }),
        ...getCapabilityExecutionField(row, status),
        ...(executions.length ? { executions } : {}),
    };
}


function mapAssistantRequest(row: Row, requestId: string, scope: AssistantRequestScope, status: AssistantRequestStatus, skills: ReturnType<typeof readAssistantRequestSkills>, authorMessage: Row, executions: AssistantCapabilityExecution[]): AssistantRequest {
    return {
        id: String(row.id), articleId: String(row.article_id), baseRevisionId: String(row.base_revision_id), scope,
        ...skills,
        status,
        authorMessage: String(authorMessage.content),
        ...getAssistantRequestDetails(row, authorMessage, executions, status),
        createdAt: String(row.created_at), updatedAt: String(row.updated_at)
    };
}


export function mapAssistantRequestFromRow(database: SqliteDatabase, row: Row): AssistantRequest {
    const requestId = String(row.id);
    const { scope, status } = readAssistantRequestMetadata(row);
    const skills = readAssistantRequestSkills(row);
    const authorMessage = readAssistantAuthorMessage(database, requestId);
    const executions = readAssistantCapabilityExecutions(database, requestId);

    return mapAssistantRequest(row, requestId, scope, status, skills, authorMessage, executions);
}
