import type { MessageId } from "../i18n/messages.js";
import { KEY_BINDING_COMMAND, type KeyBindingCommandId } from "@skladno/shared";


export const workspaceViews = [
    "write",
    "proposal",
    "revisions",
    "fact-check",
    "style-profile",
    "translations",
    "publish",
] as const;

export type WorkspaceView = typeof workspaceViews[number];

export interface WorkspaceViewDefinition {
    id: WorkspaceView;
    label: MessageId;
    command: KeyBindingCommandId;
}


export const workspaceViewDefinitions: readonly WorkspaceViewDefinition[] = [
    { id: "write", label: "workspace.tabs.write", command: KEY_BINDING_COMMAND.VIEW_WRITE },
    { id: "proposal", label: "workspace.tabs.proposal", command: KEY_BINDING_COMMAND.VIEW_PROPOSAL },
    { id: "revisions", label: "workspace.tabs.revisions", command: KEY_BINDING_COMMAND.VIEW_REVISIONS },
    { id: "fact-check", label: "workspace.tabs.factCheck", command: KEY_BINDING_COMMAND.VIEW_FACT_CHECK },
    { id: "style-profile", label: "workspace.tabs.styleProfile", command: KEY_BINDING_COMMAND.VIEW_STYLE_PROFILE },
    { id: "translations", label: "workspace.tabs.translations", command: KEY_BINDING_COMMAND.VIEW_TRANSLATIONS },
    { id: "publish", label: "workspace.tabs.publish", command: KEY_BINDING_COMMAND.VIEW_PUBLISH },
];


export function isWorkspaceView(value: unknown): value is WorkspaceView {
    return typeof value === "string" && workspaceViews.includes(value as WorkspaceView);
}
