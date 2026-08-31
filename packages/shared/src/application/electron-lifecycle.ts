export const ELECTRON_LIFECYCLE_CHANNEL = {
    prepareClose: "skladno:lifecycle:prepare-close",
    checkpointResult: "skladno:lifecycle:checkpoint-result",
    rendererReady: "skladno:lifecycle:renderer-ready",
    menuCommand: "skladno:lifecycle:menu-command",
} as const;

export const ELECTRON_LIFECYCLE_EVENT = {
    prepareClose: "skladno:prepare-close",
    checkpointResult: "skladno:checkpoint-result",
    menuCommand: "skladno:menu-command",
} as const;


export interface ElectronPrepareCloseRequest {
    requestId: string;
}


export interface ElectronCheckpointResult extends ElectronPrepareCloseRequest {
    ok: boolean;
}
