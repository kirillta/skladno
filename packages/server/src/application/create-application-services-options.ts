import { ApplicationServiceStores, ApplicationSettingsDependencies, ApplicationServiceIntegration } from "./create-application-services.js";
import type { AuthorSkillRevisionStore } from "./assistant/skills/author-skill-revision-store.js";


export interface CreateApplicationServicesOptions {
    stores: ApplicationServiceStores;
    settings: ApplicationSettingsDependencies;
    integration?: ApplicationServiceIntegration;
    skillPackages?: { builtInRoot?: string; authorRoot?: string; revisions?: AuthorSkillRevisionStore; };
}
