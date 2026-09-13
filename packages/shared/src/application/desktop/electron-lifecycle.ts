export const ELECTRON_LIFECYCLE_CHANNEL = {
    prepareClose: "skladno:lifecycle:prepare-close",
    checkpointResult: "skladno:lifecycle:checkpoint-result",
    rendererReady: "skladno:lifecycle:renderer-ready",
} as const;

export const ELECTRON_LIFECYCLE_EVENT = {
    prepareClose: "skladno:prepare-close",
    checkpointResult: "skladno:checkpoint-result",
} as const;


export interface ElectronPrepareCloseRequest {
    requestId: string;
}


export interface ElectronCheckpointResult extends ElectronPrepareCloseRequest {
    ok: boolean;
}
