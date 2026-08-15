import type { ApplicationClient } from "./health.js";
import type { ArticleLibraryClient } from "../articles/workspace/workspace.js";
import type { EditorialClient, FactCheckClient } from "../editorial/editorial.js";
import type { ApplicationSettingsClient } from "../settings/settings.js";
import type { PublishingClient } from "../publishing/publishing.js";
import type { ArticleStyleCorpusSnapshotClient, ArticleStyleRulesClient, StyleCorpusClient } from "../style/style.js";


export interface EditorialWorkspaceClient extends ApplicationClient, ArticleLibraryClient, EditorialClient, FactCheckClient, StyleCorpusClient, ArticleStyleRulesClient, ArticleStyleCorpusSnapshotClient, PublishingClient, ApplicationSettingsClient { }
