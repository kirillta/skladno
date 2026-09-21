import { ApplicationServiceStores, ApplicationSettingsDependencies, ApplicationServiceIntegration } from "./create-application-services.js";


export interface CreateApplicationServicesOptions {
    stores: ApplicationServiceStores;
    settings: ApplicationSettingsDependencies;
    integration?: ApplicationServiceIntegration;
    skillPackages?: { builtInRoot?: string; authorRoot?: string; };
}
