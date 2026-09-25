import { APPLICATION_ERROR, HTTP_STATUS, type ArticleRevision, type AssistantCheckpointDraftMode, type AssistantCheckpointPreview, type AssistantEditMode, type RestoreAssistantCheckpointResult } from "@skladno/shared";

import type { ArticleService } from "../articles/article-service.js";
import { ApplicationServiceError } from "../errors/application-service-error.js";
import { normalizeGeneralSettings } from "../settings/application-settings-normalizers.js";
import type { SettingsStore } from "../settings/settings-store.js";
import { AssistantCheckpointError, AssistantEditError, type AssistantStore } from "./assistant-store.js";


export class AssistantEditService {
    constructor(private readonly assistant: AssistantStore, private readonly settings: SettingsStore, private readonly articles: Pick<ArticleService, "describeContentChange">) { }


    getEditMode(articleId: string): AssistantEditMode {
        const defaultMode = normalizeGeneralSettings(this.settings.getSetting("application-general")?.value).defaultAssistantEditMode;
        return this.assistant.getEditMode(articleId, defaultMode);
    }


    setEditMode(articleId: string, mode: AssistantEditMode): AssistantEditMode {
        return this.assistant.setEditMode(articleId, mode);
    }


    async applyEdit(articleId: string, messageId: string): Promise<ArticleRevision> {
        try {
            const preview = this.assistant.previewEdit(articleId, messageId);
            const locale = normalizeGeneralSettings(this.settings.getSetting("application-general")?.value).interfaceLocale;
            const description = preview
                ? await this.articles.describeContentChange(preview.previousContent, preview.content, locale, new AbortController().signal)
                : undefined;

            return this.assistant.applyEdit(articleId, messageId, description);
        } catch (error) {
            throw this.toApplicationEditError(error);
        }
    }


    rejectTranslation(articleId: string, editorialArtifactId: string): void {
        this.assistant.rejectTranslation(articleId, editorialArtifactId);
    }


    previewCheckpoint(articleId: string, messageId: string): AssistantCheckpointPreview {
        return this.runCheckpoint(() => this.assistant.previewCheckpoint(articleId, messageId));
    }


    restoreCheckpoint(articleId: string, messageId: string, tailToken: string, draftMode?: AssistantCheckpointDraftMode): RestoreAssistantCheckpointResult {
        return this.runCheckpoint(() => this.assistant.restoreCheckpoint(articleId, messageId, tailToken, draftMode));
    }


    private runCheckpoint<T>(operation: () => T): T {
        try {
            return operation();
        } catch (error) {
            if (error instanceof AssistantCheckpointError) {
                const errorCode = error.kind === "conflict"
                    ? APPLICATION_ERROR.ASSISTANT_CHECKPOINT_CONFLICT
                    : APPLICATION_ERROR.ASSISTANT_CHECKPOINT_INVALID;
                const httpStatus = error.kind === "conflict"
                    ? HTTP_STATUS.CONFLICT
                    : HTTP_STATUS.BAD_REQUEST;

                throw new ApplicationServiceError(errorCode, httpStatus);
            }

            throw error;
        }
    }


    private toApplicationEditError(error: unknown): unknown {
        if (!(error instanceof AssistantEditError))
            return error;

        const errorCode = error.kind === "conflict" ? APPLICATION_ERROR.ASSISTANT_EDIT_CONFLICT : APPLICATION_ERROR.ASSISTANT_EDIT_INVALID;
        const httpStatus = error.kind === "conflict" ? HTTP_STATUS.CONFLICT : HTTP_STATUS.BAD_REQUEST;

        return new ApplicationServiceError(errorCode, httpStatus);
    }
}
