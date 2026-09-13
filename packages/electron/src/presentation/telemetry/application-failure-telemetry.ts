import type { TelemetryEvent } from "@skladno/shared";


export function applicationFailureEvent(source: "renderer" | "child_process", reason: string): TelemetryEvent | undefined {
    switch (reason) {
        case "crashed":
        case "killed":
        case "oom":
            return { kind: "app_failure", source, failure: "unknown", termination: reason };
        case "launch-failed":
            return { kind: "app_failure", source, failure: "configuration", termination: "launch_failed" };
        case "integrity-failure":
            return { kind: "app_failure", source, failure: "configuration", termination: "integrity_failure" };
        case "abnormal-exit":
            return { kind: "app_failure", source, failure: "unknown", termination: "abnormal_exit" };
        default:
            return undefined;
    }
}
