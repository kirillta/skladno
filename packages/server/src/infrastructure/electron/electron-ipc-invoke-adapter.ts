import { APPLICATION_ERROR, ELECTRON_APPLICATION_METHOD, HTTP_STATUS, isElectronApplicationMethod, type ElectronApplicationMethod, type ElectronInvokeRequest, type ElectronInvokeResult, type ElectronIpcError } from "@skladno/shared";

import type { ApplicationServices } from "../../application/application-services.js";
import { ArticleDraftConflictError } from "../../application/errors/article-draft-conflict-error.js";
import { ArticleRevisionConflictError } from "../../application/errors/article-revision-conflict-error.js";
import { ApplicationServiceError } from "../../application/errors/application-service-error.js";


function isFactCheckResolution(value: unknown): value is NonNullable<import("@skladno/shared").FactCheckFinding["resolution"]> {
    return value === "corrected_or_removed" || value === "accepted_as_written" || value === "evidence_accepted";
}


function errorPayload(error: unknown): ElectronIpcError {
    if (error instanceof ArticleRevisionConflictError)
        return { code: APPLICATION_ERROR.REVISION_CONFLICT, status: HTTP_STATUS.CONFLICT, article: error.article };

    if (error instanceof ArticleDraftConflictError)
        return { code: APPLICATION_ERROR.DRAFT_CONFLICT, status: HTTP_STATUS.CONFLICT, article: error.article, ...(error.draft ? { draft: error.draft } : {}) };

    if (error instanceof ApplicationServiceError)
        return { code: error.code, status: error.status, ...(error.parameters ? { parameters: error.parameters } : {}) };

    return { code: APPLICATION_ERROR.EDITORIAL_REQUEST_FAILED, status: HTTP_STATUS.INTERNAL_SERVER_ERROR };
}


function validInvokeRequest(value: unknown): value is ElectronInvokeRequest {
    if (!value || typeof value !== "object")
        return false;

    const candidate = value as { method?: unknown; args?: unknown };
    return isElectronApplicationMethod(candidate.method) && Array.isArray(candidate.args);
}


async function invokeApplicationMethod(method: ElectronApplicationMethod, args: readonly unknown[], services: ApplicationServices, now: () => string): Promise<unknown> {
    switch (method) {
        case ELECTRON_APPLICATION_METHOD.getHealth: return { status: "ok", service: "skladno-local-service", timestamp: now() };
        case ELECTRON_APPLICATION_METHOD.getApplicationSettings: return services.settings.getSnapshot();
        case ELECTRON_APPLICATION_METHOD.updateGeneralSettings: return services.settings.updateGeneral(args[0]);
        case ELECTRON_APPLICATION_METHOD.updateBackupPolicy: return services.settings.updateBackupPolicy(args[0]);
        case ELECTRON_APPLICATION_METHOD.updateKeyBindingOverrides: return services.settings.updateKeyBindingOverrides(args[0]);
        case ELECTRON_APPLICATION_METHOD.addAiConnection: return services.settings.createAiConnection(args[0] as { label?: unknown; environmentVariableName?: unknown });
        case ELECTRON_APPLICATION_METHOD.updateAiConnection: return services.settings.updateAiConnection(String(args[0]), args[1] as { label?: unknown; environmentVariableName?: unknown });
        case ELECTRON_APPLICATION_METHOD.removeAiConnection: return services.settings.deleteAiConnection(String(args[0]));
        case ELECTRON_APPLICATION_METHOD.setAiConnectionActive: return services.settings.setAiConnectionActive(String(args[0]), args[1] === true);
        case ELECTRON_APPLICATION_METHOD.testAiConnection: return services.settings.testAiConnection(String(args[0]));
        case ELECTRON_APPLICATION_METHOD.refreshAiModels: return services.settings.listAiModels();
        case ELECTRON_APPLICATION_METHOD.updateModelPreferences: return services.settings.updateModelPreferences(args[0]);
        case ELECTRON_APPLICATION_METHOD.listArticles: return services.articles.listArticles();
        case ELECTRON_APPLICATION_METHOD.createArticle: return services.articles.createArticle(args[0] as import("@skladno/shared").CreateArticleInput);
        case ELECTRON_APPLICATION_METHOD.updateArticle: return services.articles.updateArticle(String(args[0]), args[1] as import("@skladno/shared").UpdateArticleInput);
        case ELECTRON_APPLICATION_METHOD.deleteArticle: return services.articles.deleteArticle(String(args[0]));
        case ELECTRON_APPLICATION_METHOD.setArticleArchived: return services.articles.setArticleArchived(String(args[0]), args[1] === true);
        case ELECTRON_APPLICATION_METHOD.setArticlePinned: return services.articles.setArticlePinned(String(args[0]), args[1] === true);
        case ELECTRON_APPLICATION_METHOD.reorderPinnedArticles:
            if (!Array.isArray(args[0]) || args[0].some((id) => typeof id !== "string"))
                throw new ApplicationServiceError(APPLICATION_ERROR.INVALID_REQUEST, HTTP_STATUS.BAD_REQUEST);

            return services.articles.reorderPinnedArticles(args[0]);
        case ELECTRON_APPLICATION_METHOD.saveArticleDraft: return services.articles.saveDraft(String(args[0]), args[1] as import("@skladno/shared").SaveArticleDraftInput);
        case ELECTRON_APPLICATION_METHOD.discardArticleDraft: return services.articles.discardDraft(String(args[0]), Number(args[1]));
        case ELECTRON_APPLICATION_METHOD.saveArticleRevision: return services.articles.saveRevision(String(args[0]), args[1] as import("@skladno/shared").SaveArticleRevisionInput);
        case ELECTRON_APPLICATION_METHOD.listArticleRevisions: return services.articles.listRevisions(String(args[0]));
        case ELECTRON_APPLICATION_METHOD.acceptProposal: return services.articles.acceptProposal(String(args[0]), args[1] as import("@skladno/shared").AcceptProposalInput);
        case ELECTRON_APPLICATION_METHOD.summarizeProposal: return services.proposalSummaries.summarize(String(args[0]), args[1], new AbortController().signal);
        case ELECTRON_APPLICATION_METHOD.restoreRevision: return services.articles.restoreRevision(String(args[0]), String(args[1]));
        case ELECTRON_APPLICATION_METHOD.listAssistantMessages: return services.assistant.listMessages(String(args[0]));
        case ELECTRON_APPLICATION_METHOD.listFactChecks: return services.factChecks.list(String(args[0]));
        case ELECTRON_APPLICATION_METHOD.resolveFactCheckFinding:
            if (!isFactCheckResolution(args[2]))
                throw new ApplicationServiceError(APPLICATION_ERROR.INVALID_REQUEST, HTTP_STATUS.BAD_REQUEST);

            return services.factChecks.resolve(String(args[1]), args[2]);
        case ELECTRON_APPLICATION_METHOD.getStyleCorpus: return services.styleCorpus.get();
        case ELECTRON_APPLICATION_METHOD.addStyleCorpusItem: return services.styleCorpus.add(args[0] as import("@skladno/shared").CreateStyleCorpusItemInput, new AbortController().signal);
        case ELECTRON_APPLICATION_METHOD.setStyleCorpusItemIncluded: return services.styleCorpus.setIncluded(String(args[0]), Boolean(args[1]));
        case ELECTRON_APPLICATION_METHOD.setStyleCorpusRules: return services.styleCorpus.setRules(String(args[0]));
        case ELECTRON_APPLICATION_METHOD.rebuildStyleCorpus: return services.styleCorpus.rebuild();
        case ELECTRON_APPLICATION_METHOD.getArticleStyleRules: return services.styleCorpus.getArticleRules(String(args[0]));
        case ELECTRON_APPLICATION_METHOD.setArticleStyleRules: return services.styleCorpus.setArticleRules(String(args[0]), String(args[1]));
        case ELECTRON_APPLICATION_METHOD.addArticleRevisionStyleCorpusItem: return services.styleCorpus.addArticleRevision(String(args[0]), String(args[1]));
        case ELECTRON_APPLICATION_METHOD.removeStyleCorpusItem: return services.styleCorpus.remove(String(args[0]));
        case ELECTRON_APPLICATION_METHOD.getPublishingSettings: return services.publishing.getSettings();
        case ELECTRON_APPLICATION_METHOD.setPublishingSettings: return services.publishing.setSettings(args[0] as import("@skladno/shared").PublishingSettings);
    }
}


export async function invokeElectronApplication(request: unknown, services: ApplicationServices, now: () => string): Promise<ElectronInvokeResult> {
    if (!validInvokeRequest(request))
        return { ok: false, error: { code: APPLICATION_ERROR.INVALID_REQUEST, status: HTTP_STATUS.BAD_REQUEST } };

    try {
        return { ok: true, value: await invokeApplicationMethod(request.method, request.args, services, now) } as ElectronInvokeResult;
    } catch (error) {
        return { ok: false, error: errorPayload(error) };
    }
}
