import { acceptProposalPath, aiAppModelPath, aiConnectionsPath, aiModelPreferencesPath, aiModelsPath, applicationSettingsPath, assistantSkillsPath, backupExportsPath, backupImportsPath, createArticleArchivePath, createArticleDraftPath, createArticlePinPath, createArticleRevisionsPath, articlesPath, createArticleStyleCorpusSnapshotPath, createArticleStyleRulesPath, createAssistantApplyEditPath, createAssistantEditModePath, createAssistantCheckpointPreviewPath, createAssistantCheckpointRestorePath, createAssistantMessagesPath, createAssistantRequestsPath, createAssistantTranslationRejectionPath, backupsPath, createEditorialPath, createFactCheckResolutionPath, createFactChecksPath, HTTP_METHOD, healthPath, keyBindingsPath, pinnedArticleOrderPath, createProposalSummariesPath, publishSettingsPath, restoreBackupPath, restoreRevisionPath, styleCorpusPath, styleCorpusRebuildPath, styleCorpusRulesPath } from "@skladno/shared";

import type { ApplicationServices } from "../../application/application-services.js";
import type { EditorialService } from "../../application/editorial/editorial-service.js";
import type { LocalDiagnostics } from "../../infrastructure/diagnostics/local-diagnostics.js";
import type { BackupBundleTransfers } from "../../infrastructure/persistence/backup-bundle.js";
import { Router } from "../router.js";
import { acceptProposalRoute, createArticleRoute, deleteArticleRoute, discardDraftRoute, listArticlesRoute, listRevisionsRoute, reorderPinnedArticlesRoute, restoreRevisionRoute, saveDraftRoute, saveRevisionRoute, setArticleArchivedRoute, setArticlePinnedRoute, updateArticleRoute } from "./articles-route.js";
import { applyAssistantEditRoute, createAssistantRequestRoute, getAssistantEditModeRoute, listAssistantMessagesRoute, listAssistantSkillsRoute, previewAssistantCheckpointRoute, rejectAssistantTranslationRoute, restoreAssistantCheckpointRoute, setAssistantEditModeRoute } from "./assistant-route.js";
import { handleEditorialRoute } from "./editorial-route.js";
import { handleHealthRoute } from "./health-route.js";
import { handlePublishSettingsRoute, updatePublishSettingsRoute } from "./publish-settings-route.js";
import { handleAiModelsRoute, handleAppModelRoute, handleBackupPolicyRoute, handleCreateAiConnectionRoute, handleCreateBackupRoute, handleDeleteAiConnectionRoute, handleGeneralSettingsRoute, handleKeyBindingsRoute, handleModelPreferencesRoute, handleRestoreBackupRoute, handleSetAiConnectionActiveRoute, handleSettingsSnapshotRoute, handleTestAiConnectionRoute, handleUpdateAiConnectionRoute } from "./settings-route.js";
import { addArticleRevisionStyleCorpusItemRoute, createStyleCorpusItemRoute, deleteStyleCorpusItemRoute, getArticleStyleRulesRoute, handleStyleCorpusRoute, rebuildStyleCorpusRoute, setArticleStyleRulesRoute, updateStyleCorpusItemRoute, updateStyleCorpusRulesRoute } from "./style-corpus-route.js";
import { beginBackupImportRoute, createBackupExportRoute, readBackupExportRoute, removeBackupTransferRoute, restoreBackupImportRoute, writeBackupImportRoute } from "./backup-bundle-route.js";
import { summarizeProposalRoute } from "./proposal-summary-route.js";
import { listFactChecksRoute, resolveFactCheckRoute } from "./fact-check-route.js";


const ROUTE_PARAMETER = "__route_parameter__";


function createRoutePattern(path: string): RegExp {
    return new RegExp(`^${path.replaceAll(ROUTE_PARAMETER, "([^/]+)")}$`);
}


const ARTICLE_PATH = createRoutePattern(`${articlesPath}/${ROUTE_PARAMETER}`);
const ARTICLE_ARCHIVE_PATH = createRoutePattern(createArticleArchivePath(ROUTE_PARAMETER));
const ARTICLE_PIN_PATH = createRoutePattern(createArticlePinPath(ROUTE_PARAMETER));
const ARTICLE_DRAFT_PATH = createRoutePattern(createArticleDraftPath(ROUTE_PARAMETER));
const ARTICLE_REVISIONS_PATH = createRoutePattern(createArticleRevisionsPath(ROUTE_PARAMETER));
const ARTICLE_PROPOSAL_ACCEPTANCES_PATH = createRoutePattern(acceptProposalPath(ROUTE_PARAMETER));
const ARTICLE_PROPOSAL_SUMMARIES_PATH = createRoutePattern(createProposalSummariesPath(ROUTE_PARAMETER));
const ARTICLE_RESTORATION_PATH = createRoutePattern(restoreRevisionPath(ROUTE_PARAMETER, ROUTE_PARAMETER));
const ASSISTANT_MESSAGES_PATH = createRoutePattern(createAssistantMessagesPath(ROUTE_PARAMETER));
const ASSISTANT_REQUESTS_PATH = createRoutePattern(createAssistantRequestsPath(ROUTE_PARAMETER));
const ASSISTANT_EDIT_MODE_PATH = createRoutePattern(createAssistantEditModePath(ROUTE_PARAMETER));
const ASSISTANT_APPLY_EDIT_PATH = createRoutePattern(createAssistantApplyEditPath(ROUTE_PARAMETER, ROUTE_PARAMETER));
const ASSISTANT_TRANSLATION_REJECTION_PATH = createRoutePattern(createAssistantTranslationRejectionPath(ROUTE_PARAMETER, ROUTE_PARAMETER));
const ASSISTANT_CHECKPOINT_PREVIEW_PATH = createRoutePattern(createAssistantCheckpointPreviewPath(ROUTE_PARAMETER, ROUTE_PARAMETER));
const ASSISTANT_CHECKPOINT_RESTORE_PATH = createRoutePattern(createAssistantCheckpointRestorePath(ROUTE_PARAMETER, ROUTE_PARAMETER));
const EDITORIAL_PATH = createRoutePattern(createEditorialPath(ROUTE_PARAMETER));
const FACT_CHECKS_PATH = createRoutePattern(createFactChecksPath(ROUTE_PARAMETER));
const FACT_CHECK_RESOLUTION_PATH = createRoutePattern(createFactCheckResolutionPath(ROUTE_PARAMETER, ROUTE_PARAMETER));
const STYLE_CORPUS_ITEM_PATH = createRoutePattern(`${styleCorpusPath}/${ROUTE_PARAMETER}`);
const ARTICLE_STYLE_RULES_PATH = createRoutePattern(createArticleStyleRulesPath(ROUTE_PARAMETER));
const ARTICLE_STYLE_CORPUS_SNAPSHOT_PATH = createRoutePattern(createArticleStyleCorpusSnapshotPath(ROUTE_PARAMETER, ROUTE_PARAMETER));
const AI_CONNECTION_PATH = createRoutePattern(`${aiConnectionsPath}/${ROUTE_PARAMETER}`);
const ACTIVE_AI_CONNECTION_PATH = createRoutePattern(`${aiConnectionsPath}/${ROUTE_PARAMETER}/active`);
const TEST_AI_CONNECTION_PATH = createRoutePattern(`${aiConnectionsPath}/${ROUTE_PARAMETER}/test`);
const BACKUP_EXPORT_PATH = createRoutePattern(`${backupExportsPath}/${ROUTE_PARAMETER}`);
const BACKUP_EXPORT_FILE_PATH = createRoutePattern(`${backupExportsPath}/${ROUTE_PARAMETER}/${ROUTE_PARAMETER}`);
const BACKUP_IMPORT_PATH = createRoutePattern(`${backupImportsPath}/${ROUTE_PARAMETER}`);
const BACKUP_IMPORT_FILE_PATH = createRoutePattern(`${backupImportsPath}/${ROUTE_PARAMETER}/${ROUTE_PARAMETER}`);
const BACKUP_IMPORT_RESTORE_PATH = createRoutePattern(`${backupImportsPath}/${ROUTE_PARAMETER}/restore`);


export function createPresentationRouter(editorial: EditorialService, services: ApplicationServices, diagnostics?: LocalDiagnostics, restoreBackup?: (snapshot: Uint8Array) => Promise<void>, backupTransfers?: BackupBundleTransfers): Router {
    const { articles, assistant, factChecks, proposalSummaries, publishing, settings, skills, styleCorpus } = services;
    const router = new Router();

    router.register(HTTP_METHOD.GET, healthPath, (_request, response) => handleHealthRoute(response));
    router.register(HTTP_METHOD.GET, assistantSkillsPath, (_request, response) => listAssistantSkillsRoute(response, skills));
    router.register(HTTP_METHOD.GET, ASSISTANT_MESSAGES_PATH, (_request, response, parameters) => listAssistantMessagesRoute(response, parameters[0]!, assistant));
    router.register(HTTP_METHOD.GET, ASSISTANT_EDIT_MODE_PATH, (_request, response, parameters) => getAssistantEditModeRoute(response, parameters[0]!, assistant));
    router.register(HTTP_METHOD.PUT, ASSISTANT_EDIT_MODE_PATH, (request, response, parameters) => setAssistantEditModeRoute(request, response, parameters[0]!, assistant));
    router.register(HTTP_METHOD.POST, ASSISTANT_APPLY_EDIT_PATH, (_request, response, parameters) => applyAssistantEditRoute(response, parameters[0]!, parameters[1]!, assistant));
    router.register(HTTP_METHOD.POST, ASSISTANT_REQUESTS_PATH, (request, response, parameters) => createAssistantRequestRoute(request, response, parameters[0]!, assistant, diagnostics));
    router.register(HTTP_METHOD.POST, ASSISTANT_TRANSLATION_REJECTION_PATH, (_request, response, parameters) => rejectAssistantTranslationRoute(response, parameters[0]!, parameters[1]!, assistant));
    router.register(HTTP_METHOD.GET, ASSISTANT_CHECKPOINT_PREVIEW_PATH, (_request, response, parameters) => previewAssistantCheckpointRoute(response, parameters[0]!, parameters[1]!, assistant));
    router.register(HTTP_METHOD.POST, ASSISTANT_CHECKPOINT_RESTORE_PATH, (request, response, parameters) => restoreAssistantCheckpointRoute(request, response, parameters[0]!, parameters[1]!, assistant));
    router.register(HTTP_METHOD.POST, EDITORIAL_PATH, (request, response, parameters) => handleEditorialRoute(request, response, parameters[0]!, editorial));
    router.register(HTTP_METHOD.GET, FACT_CHECKS_PATH, (_request, response, parameters) => listFactChecksRoute(response, parameters[0]!, factChecks));
    router.register(HTTP_METHOD.PUT, FACT_CHECK_RESOLUTION_PATH, (request, response, parameters) => resolveFactCheckRoute(request, response, parameters[0]!, parameters[1]!, factChecks));
    router.register(HTTP_METHOD.GET, styleCorpusPath, (_request, response) => handleStyleCorpusRoute(response, styleCorpus));
    router.register(HTTP_METHOD.POST, ARTICLE_STYLE_CORPUS_SNAPSHOT_PATH, (_request, response, parameters) => addArticleRevisionStyleCorpusItemRoute(response, parameters[0]!, parameters[1]!, styleCorpus));
    router.register(HTTP_METHOD.POST, styleCorpusPath, (request, response) => createStyleCorpusItemRoute(request, response, styleCorpus));
    router.register(HTTP_METHOD.PUT, styleCorpusRulesPath, (request, response) => updateStyleCorpusRulesRoute(request, response, styleCorpus));
    router.register(HTTP_METHOD.POST, styleCorpusRebuildPath, (_request, response) => rebuildStyleCorpusRoute(response, styleCorpus));
    router.register(HTTP_METHOD.PUT, STYLE_CORPUS_ITEM_PATH, (request, response, parameters) => updateStyleCorpusItemRoute(request, response, parameters[0]!, styleCorpus));
    router.register(HTTP_METHOD.DELETE, STYLE_CORPUS_ITEM_PATH, (_request, response, parameters) => deleteStyleCorpusItemRoute(response, parameters[0]!, styleCorpus));
    router.register(HTTP_METHOD.GET, ARTICLE_STYLE_RULES_PATH, (_request, response, parameters) => getArticleStyleRulesRoute(response, parameters[0]!, styleCorpus));
    router.register(HTTP_METHOD.PUT, ARTICLE_STYLE_RULES_PATH, (request, response, parameters) => setArticleStyleRulesRoute(request, response, parameters[0]!, styleCorpus));
    router.register(HTTP_METHOD.GET, applicationSettingsPath, (_request, response) => handleSettingsSnapshotRoute(response, settings));
    router.register(HTTP_METHOD.PUT, `${applicationSettingsPath}/general`, (request, response) => handleGeneralSettingsRoute(request, response, settings));
    router.register(HTTP_METHOD.PUT, `${applicationSettingsPath}/backup-policy`, (request, response) => handleBackupPolicyRoute(request, response, settings));
    router.register(HTTP_METHOD.POST, backupsPath, (_request, response) => handleCreateBackupRoute(response, settings, diagnostics));
    if (restoreBackup)
        router.register(HTTP_METHOD.POST, restoreBackupPath, (request, response) => handleRestoreBackupRoute(request, response, restoreBackup));

    if (backupTransfers) {
        router.register(HTTP_METHOD.POST, backupExportsPath, (_request, response) => createBackupExportRoute(response, backupTransfers));
        router.register(HTTP_METHOD.GET, BACKUP_EXPORT_FILE_PATH, (_request, response, parameters) => readBackupExportRoute(response, backupTransfers, parameters[0]!, parameters[1]!));
        router.register(HTTP_METHOD.DELETE, BACKUP_EXPORT_PATH, (_request, response, parameters) => removeBackupTransferRoute(response, backupTransfers, parameters[0]!));
        router.register(HTTP_METHOD.POST, backupImportsPath, (request, response) => beginBackupImportRoute(request, response, backupTransfers));
        router.register(HTTP_METHOD.PUT, BACKUP_IMPORT_FILE_PATH, (request, response, parameters) => writeBackupImportRoute(request, response, backupTransfers, parameters[0]!, parameters[1]!));
        router.register(HTTP_METHOD.POST, BACKUP_IMPORT_RESTORE_PATH, (_request, response, parameters) => restoreBackupImportRoute(response, backupTransfers, parameters[0]!));
        router.register(HTTP_METHOD.DELETE, BACKUP_IMPORT_PATH, (_request, response, parameters) => removeBackupTransferRoute(response, backupTransfers, parameters[0]!));
    }

    router.register(HTTP_METHOD.PUT, keyBindingsPath, (request, response) => handleKeyBindingsRoute(request, response, settings));
    router.register(HTTP_METHOD.PUT, aiModelPreferencesPath, (request, response) => handleModelPreferencesRoute(request, response, settings));
    router.register(HTTP_METHOD.PUT, aiAppModelPath, (request, response) => handleAppModelRoute(request, response, settings));
    router.register(HTTP_METHOD.POST, aiConnectionsPath, (request, response) => handleCreateAiConnectionRoute(request, response, settings));
    router.register(HTTP_METHOD.PUT, ACTIVE_AI_CONNECTION_PATH, (request, response, parameters) => handleSetAiConnectionActiveRoute(request, response, parameters[0]!, settings));
    router.register(HTTP_METHOD.POST, TEST_AI_CONNECTION_PATH, (_request, response, parameters) => handleTestAiConnectionRoute(response, parameters[0]!, settings));
    router.register(HTTP_METHOD.PUT, AI_CONNECTION_PATH, (request, response, parameters) => handleUpdateAiConnectionRoute(request, response, parameters[0]!, settings));
    router.register(HTTP_METHOD.DELETE, AI_CONNECTION_PATH, (_request, response, parameters) => handleDeleteAiConnectionRoute(response, parameters[0]!, settings));
    router.register(HTTP_METHOD.POST, aiModelsPath, (_request, response) => handleAiModelsRoute(response, settings));
    router.register(HTTP_METHOD.GET, publishSettingsPath, (_request, response) => handlePublishSettingsRoute(response, publishing));
    router.register(HTTP_METHOD.PUT, publishSettingsPath, (request, response) => updatePublishSettingsRoute(request, response, publishing));
    router.register(HTTP_METHOD.GET, articlesPath, (_request, response) => listArticlesRoute(response, articles));
    router.register(HTTP_METHOD.POST, articlesPath, (request, response) => createArticleRoute(request, response, articles));
    router.register(HTTP_METHOD.PUT, pinnedArticleOrderPath, (request, response) => reorderPinnedArticlesRoute(request, response, articles));
    router.register(HTTP_METHOD.PUT, ARTICLE_ARCHIVE_PATH, (request, response, parameters) => setArticleArchivedRoute(request, response, parameters[0]!, articles));
    router.register(HTTP_METHOD.PUT, ARTICLE_PIN_PATH, (request, response, parameters) => setArticlePinnedRoute(request, response, parameters[0]!, articles));
    router.register(HTTP_METHOD.PATCH, ARTICLE_PATH, (request, response, parameters) => updateArticleRoute(request, response, parameters[0]!, articles));
    router.register(HTTP_METHOD.DELETE, ARTICLE_PATH, (_request, response, parameters) => deleteArticleRoute(response, parameters[0]!, articles));
    router.register(HTTP_METHOD.PUT, ARTICLE_DRAFT_PATH, (request, response, parameters) => saveDraftRoute(request, response, parameters[0]!, articles));
    router.register(HTTP_METHOD.DELETE, ARTICLE_DRAFT_PATH, (request, response, parameters) => discardDraftRoute(request, response, parameters[0]!, articles));
    router.register(HTTP_METHOD.POST, ARTICLE_REVISIONS_PATH, (request, response, parameters) => saveRevisionRoute(request, response, parameters[0]!, articles));
    router.register(HTTP_METHOD.GET, ARTICLE_REVISIONS_PATH, (_request, response, parameters) => listRevisionsRoute(response, parameters[0]!, articles));
    router.register(HTTP_METHOD.POST, ARTICLE_PROPOSAL_ACCEPTANCES_PATH, (request, response, parameters) => acceptProposalRoute(request, response, parameters[0]!, articles));
    router.register(HTTP_METHOD.POST, ARTICLE_PROPOSAL_SUMMARIES_PATH, (request, response, parameters) => summarizeProposalRoute(request, response, parameters[0]!, proposalSummaries));
    router.register(HTTP_METHOD.POST, ARTICLE_RESTORATION_PATH, (_request, response, parameters) => restoreRevisionRoute(response, parameters[0]!, parameters[1]!, articles));

    return router;
}
