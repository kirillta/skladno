export interface TransportEvaluation {
    transport: "http" | "stream" | "electron";
    operation?: string;
    outsideAssistantAuthority?: string;
}
