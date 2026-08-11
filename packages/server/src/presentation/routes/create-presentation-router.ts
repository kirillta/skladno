import { acceptProposalPath, aiConnectionsPath, aiModelPreferencesPath, aiModelsPath, applicationSettingsPath, articleDraftPath, articleRevisionsPath, articlesPath, assistantMessagesPath, assistantRequestsPath, editorialPath, HTTP_METHOD, healthPath, keyBindingsPath, proposalSummariesPath, publishSettingsPath, restoreRevisionPath, styleCorpusPath } from "@skladno/shared";

import type { ApplicationServices } from "../../application/application-services.js";
import type { EditorialService } from "../../application/editorial/editorial-service.js";
import { Router } from "../router.js";
import { acceptProposalRoute, createArticleRoute, deleteArticleRoute, discardDraftRoute, listArticlesRoute, listRevisionsRoute, restoreRevisionRoute, saveDraftRoute, saveRevisionRoute, updateArticleRoute } from "./articles-route.js";
import { createAssistantRequestRoute, listAssistantMessagesRoute } from "./assistant-route.js";
import { handleEditorialRoute } from "./editorial-route.js";
import { handleHealthRoute } from "./health-route.js";
import { handlePublishSettingsRoute, updatePublishSettingsRoute } from "./publish-settings-route.js";
import { handleActivateAiConnectionRoute, handleAiModelsRoute, handleBackupPolicyRoute, handleCreateAiConnectionRoute, handleDeleteAiConnectionRoute, handleGeneralSettingsRoute, handleKeyBindingsRoute, handleModelPreferencesRoute, handleSettingsSnapshotRoute, handleTestAiConnectionRoute, handleUpdateAiConnectionRoute } from "./settings-route.js";
import { createStyleCorpusItemRoute, deleteStyleCorpusItemRoute, handleStyleCorpusRoute } from "./style-corpus-route.js";
import { summarizeProposalRoute } from "./proposal-summary-route.js";


const ROUTE_PARAMETER = "__route_parameter__";


function routePattern(path: string): RegExp {
    return new RegExp(`^${path.replaceAll(ROUTE_PARAMETER, "([^/]+)")}$`);
}


const ARTICLE_PATH = routePattern(`${articlesPath}/${ROUTE_PARAMETER}`);
const ARTICLE_DRAFT_PATH = routePattern(articleDraftPath(ROUTE_PARAMETER));
const ARTICLE_REVISIONS_PATH = routePattern(articleRevisionsPath(ROUTE_PARAMETER));
const ARTICLE_PROPOSAL_ACCEPTANCES_PATH = routePattern(acceptProposalPath(ROUTE_PARAMETER));
const ARTICLE_PROPOSAL_SUMMARIES_PATH = routePattern(proposalSummariesPath(ROUTE_PARAMETER));
const ARTICLE_RESTORATION_PATH = routePattern(restoreRevisionPath(ROUTE_PARAMETER, ROUTE_PARAMETER));
const ASSISTANT_MESSAGES_PATH = routePattern(assistantMessagesPath(ROUTE_PARAMETER));
const ASSISTANT_REQUESTS_PATH = routePattern(assistantRequestsPath(ROUTE_PARAMETER));
const EDITORIAL_PATH = routePattern(editorialPath(ROUTE_PARAMETER));
const STYLE_CORPUS_ITEM_PATH = routePattern(`${styleCorpusPath}/${ROUTE_PARAMETER}`);
const AI_CONNECTION_PATH = routePattern(`${aiConnectionsPath}/${ROUTE_PARAMETER}`);
const ACTIVE_AI_CONNECTION_PATH = routePattern(`${aiConnectionsPath}/${ROUTE_PARAMETER}/active`);
const TEST_AI_CONNECTION_PATH = routePattern(`${aiConnectionsPath}/${ROUTE_PARAMETER}/test`);


export function createPresentationRouter(editorial: EditorialService, services: ApplicationServices): Router {
    const { articles, assistant, proposalSummaries, publishing, settings, styleCorpus } = services;
    const router = new Router();

    router.register(HTTP_METHOD.GET, healthPath, (_request, response) => handleHealthRoute(response));
    router.register(HTTP_METHOD.GET, ASSISTANT_MESSAGES_PATH, (_request, response, parameters) => listAssistantMessagesRoute(response, parameters[0]!, assistant));
    router.register(HTTP_METHOD.POST, ASSISTANT_REQUESTS_PATH, (request, response, parameters) => createAssistantRequestRoute(request, response, parameters[0]!, assistant));
    router.register(HTTP_METHOD.POST, EDITORIAL_PATH, (request, response, parameters) => handleEditorialRoute(request, response, parameters[0]!, editorial));
    router.register(HTTP_METHOD.GET, styleCorpusPath, (_request, response) => handleStyleCorpusRoute(response, styleCorpus));
    router.register(HTTP_METHOD.POST, styleCorpusPath, (request, response) => createStyleCorpusItemRoute(request, response, styleCorpus));
    router.register(HTTP_METHOD.DELETE, STYLE_CORPUS_ITEM_PATH, (_request, response, parameters) => deleteStyleCorpusItemRoute(response, parameters[0]!, styleCorpus));
    router.register(HTTP_METHOD.GET, applicationSettingsPath, (_request, response) => handleSettingsSnapshotRoute(response, settings));
    router.register(HTTP_METHOD.PUT, `${applicationSettingsPath}/general`, (request, response) => handleGeneralSettingsRoute(request, response, settings));
    router.register(HTTP_METHOD.PUT, `${applicationSettingsPath}/backup-policy`, (request, response) => handleBackupPolicyRoute(request, response, settings));
    router.register(HTTP_METHOD.PUT, keyBindingsPath, (request, response) => handleKeyBindingsRoute(request, response, settings));
    router.register(HTTP_METHOD.PUT, aiModelPreferencesPath, (request, response) => handleModelPreferencesRoute(request, response, settings));
    router.register(HTTP_METHOD.POST, aiConnectionsPath, (request, response) => handleCreateAiConnectionRoute(request, response, settings));
    router.register(HTTP_METHOD.PUT, ACTIVE_AI_CONNECTION_PATH, (_request, response, parameters) => handleActivateAiConnectionRoute(response, parameters[0]!, settings));
    router.register(HTTP_METHOD.POST, TEST_AI_CONNECTION_PATH, (_request, response, parameters) => handleTestAiConnectionRoute(response, parameters[0]!, settings));
    router.register(HTTP_METHOD.PUT, AI_CONNECTION_PATH, (request, response, parameters) => handleUpdateAiConnectionRoute(request, response, parameters[0]!, settings));
    router.register(HTTP_METHOD.DELETE, AI_CONNECTION_PATH, (_request, response, parameters) => handleDeleteAiConnectionRoute(response, parameters[0]!, settings));
    router.register(HTTP_METHOD.POST, aiModelsPath, (_request, response) => handleAiModelsRoute(response, settings));
    router.register(HTTP_METHOD.GET, publishSettingsPath, (_request, response) => handlePublishSettingsRoute(response, publishing));
    router.register(HTTP_METHOD.PUT, publishSettingsPath, (request, response) => updatePublishSettingsRoute(request, response, publishing));
    router.register(HTTP_METHOD.GET, articlesPath, (_request, response) => listArticlesRoute(response, articles));
    router.register(HTTP_METHOD.POST, articlesPath, (request, response) => createArticleRoute(request, response, articles));
    router.register(HTTP_METHOD.PATCH, ARTICLE_PATH, (request, response, parameters) => updateArticleRoute(request, response, parameters[0]!, articles));
    router.register(HTTP_METHOD.DELETE, ARTICLE_PATH, (_request, response, parameters) => deleteArticleRoute(response, parameters[0]!, articles));
    router.register(HTTP_METHOD.PUT, ARTICLE_DRAFT_PATH, (request, response, parameters) => saveDraftRoute(request, response, parameters[0]!, articles));
    router.register(HTTP_METHOD.DELETE, ARTICLE_DRAFT_PATH, (request, response, parameters) => discardDraftRoute(request, response, parameters[0]!, articles));
    router.register(HTTP_METHOD.POST, ARTICLE_REVISIONS_PATH, (request, response, parameters) => saveRevisionRoute(request, response, parameters[0]!, articles));
    router.register(HTTP_METHOD.GET, ARTICLE_REVISIONS_PATH, (_request, response, parameters) => listRevisionsRoute(response, parameters[0]!, articles));
    router.register(HTTP_METHOD.POST, ARTICLE_PROPOSAL_ACCEPTANCES_PATH, (request, response, parameters) => acceptProposalRoute(request, response, parameters[0]!, articles));
    router.register(HTTP_METHOD.POST, ARTICLE_PROPOSAL_SUMMARIES_PATH, (request, response) => summarizeProposalRoute(request, response, proposalSummaries));
    router.register(HTTP_METHOD.POST, ARTICLE_RESTORATION_PATH, (_request, response, parameters) => restoreRevisionRoute(response, parameters[0]!, parameters[1]!, articles));

    return router;
}
