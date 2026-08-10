import { useEffect, useState } from "react";
import { defaultGeneralSettings, type GeneralSettings } from "@skladno/shared";
import type { EditorialWorkspaceClient } from "../../application-client.js";


export function useWorkspaceGeneralSettings(client: EditorialWorkspaceClient, screen: "editorial-workspace" | "application-settings") {
    const [generalSettings, setGeneralSettings] = useState<GeneralSettings>(defaultGeneralSettings);

    useEffect(() => {
        if (screen !== "editorial-workspace")
            return;

        void client.getApplicationSettings()
            .then((settings) => setGeneralSettings(settings.general))
            .catch(() => undefined);
    }, [client, screen]);

    return generalSettings;
}
