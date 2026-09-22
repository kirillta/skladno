import { APPLICATION_ERROR, HTTP_STATUS, type AssistantAuthorizedAction } from "@skladno/shared";

import { ApplicationServiceError } from "../../errors/application-service-error.js";
import type { EditorialAssistantTool } from "../../editorial/engine/editorial-assistant-tool.js";
import type { EditorialEngineResolver } from "../../editorial/engine/editorial-engine-resolver.js";
import type { PreparedAssistantRequest } from "../requests/prepared-assistant-request.js";
import type { AuthorSkillChange } from "./author-skill-change.js";
import type { CommittedAuthorSkillChange } from "./committed-author-skill-change.js";
import type { AuthorSkillService } from "./author-skill-service.js";


export class AuthorSkillChatActions {
    constructor(
        private readonly skills: AuthorSkillService,
        private readonly engines: Pick<EditorialEngineResolver, "resolveAssistantActionIntentVerifier">,
    ) { }


    tools(request: PreparedAssistantRequest): EditorialAssistantTool[] {
        return [
            { capability: "get_author_skill", description: "Read an installed Author Skill and its current content hash before changing it.", input: "author-skill-id", execute: async (input) => this.skills.readCurrent(input.skillId ?? "") ?? { missing: true } },
            { capability: "list_author_skill_revisions", description: "List immutable Revisions for an Author Skill, including a deleted Skill.", input: "author-skill-id", execute: async (input) => this.skills.listRevisions(input.skillId ?? "") },
            { capability: "read_author_skill_revision", description: "Read one immutable Author Skill Revision.", input: "author-skill-revision", execute: async (input) => this.skills.readRevision(input.skillId ?? "", input.revisionId ?? "") ?? { missing: true } },
            { capability: "create_author_skill", description: "Save a validated local Author Skill Markdown package.", input: "author-skill", execute: (input, signal) => this.stage(request, { kind: "create", skillId: input.skillId ?? "", skillMarkdown: input.skillMarkdown ?? "" }, signal) },
            { capability: "update_author_skill", description: "Replace an installed Author Skill after reading its current hash. Appends a Skill Revision.", input: "author-skill-write", execute: (input, signal) => this.stage(request, { kind: "update", skillId: input.skillId ?? "", skillMarkdown: input.skillMarkdown ?? "", expectedHash: input.expectedHash ?? "" }, signal) },
            { capability: "restore_author_skill", description: "Restore an explicitly selected Skill Revision. Use an empty expected hash only when the Skill is deleted.", input: "author-skill-restore", execute: (input, signal) => this.stage(request, { kind: "restore", skillId: input.skillId ?? "", revisionId: input.revisionId ?? "", expectedHash: input.expectedHash ?? "" }, signal) },
            { capability: "delete_author_skill", description: "Remove an installed Author Skill from discovery while retaining its Revision history.", input: "author-skill-delete", execute: (input, signal) => this.stage(request, { kind: "delete", skillId: input.skillId ?? "", expectedHash: input.expectedHash ?? "" }, signal) },
        ];
    }


    commit(request: PreparedAssistantRequest): CommittedAuthorSkillChange | undefined {
        const change = request.pendingSkillChange;
        if (!change)
            return undefined;

        const committed = this.skills.commitChange(change, request.requestId);
        request.pendingSkillChange = undefined;
        return committed;
    }


    rollback(change: CommittedAuthorSkillChange): void {
        this.skills.rollbackChange(change);
    }


    private async stage(request: PreparedAssistantRequest, change: AuthorSkillChange, signal: AbortSignal): Promise<{ skillId: string; status: "pending" }> {
        const verifier = this.engines.resolveAssistantActionIntentVerifier?.();
        let input: Readonly<Record<string, string>> = {};
        if (change.kind === "restore")
            input = { skillId: change.skillId, revisionId: change.revisionId };
        else if (change.kind !== "create")
            input = { skillId: change.skillId };

        if (!verifier || !await verifier.verify(request.authorMessage, this.actionFor(change), input, signal))
            throw new ApplicationServiceError(APPLICATION_ERROR.INVALID_REQUEST, HTTP_STATUS.BAD_REQUEST);

        signal.throwIfAborted();
        if (request.pendingSkillChange)
            throw new ApplicationServiceError(APPLICATION_ERROR.INVALID_REQUEST, HTTP_STATUS.BAD_REQUEST);

        this.skills.validateChange(change);
        request.pendingSkillChange = change;
        return { skillId: change.skillId, status: "pending" };
    }


    private actionFor(change: AuthorSkillChange): AssistantAuthorizedAction {
        switch (change.kind) {
            case "create": return "create_author_skill";
            case "update": return "update_author_skill";
            case "restore": return "restore_author_skill";
            case "delete": return "delete_author_skill";
        }
    }
}
