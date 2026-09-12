import { tool, type ModelMessage, type ToolSet } from "ai";
import { z } from "zod";

import type { EditorialAssistantRequest } from "../../../application/models/editorial/editorial-assistant-request.js";
import { boundedArticleContext } from "../models/editorial-context.js";

type AssistantToolExecutor = (capability: string, input: Readonly<Record<string, string>>) => Promise<unknown>;
type AssistantTool = EditorialAssistantRequest["tools"][number];


function createAssistantTool(candidate: AssistantTool, execute: AssistantToolExecutor) {
    switch (candidate.input) {
        case "proposal-operation":
            return tool({
                description: candidate.description,
                inputSchema: z.object({ operation: z.enum(["thesis_to_narrative", "flow_revision"]) }),
                execute: ({ operation }) => execute(candidate.capability, { operation })
            });
        case "target-language":
            return tool({
                description: candidate.description,
                inputSchema: z.object({ targetLanguage: z.string().min(1) }),
                execute: ({ targetLanguage }) => execute(candidate.capability, { targetLanguage })
            });
        case "title":
            return tool({
                description: candidate.description,
                inputSchema: z.object({ title: z.string().min(1) }),
                execute: ({ title }) => execute(candidate.capability, { title })
            });
        case "language":
            return tool({
                description: candidate.description,
                inputSchema: z.object({ language: z.string().min(1) }),
                execute: ({ language }) => execute(candidate.capability, { language })
            });
        case "publishing-profile":
            return tool({
                description: candidate.description,
                inputSchema: z.object({ profileId: z.string().min(1) }),
                execute: ({ profileId }) => execute(candidate.capability, { profileId })
            });
        case "style-rules":
            return tool({
                description: candidate.description,
                inputSchema: z.object({ rules: z.string() }),
                execute: ({ rules }) => execute(candidate.capability, { rules })
            });
        case "artifact-id":
            return tool({
                description: candidate.description,
                inputSchema: z.object({ artifactId: z.string().min(1) }),
                execute: ({ artifactId }) => execute(candidate.capability, { artifactId })
            });
        case "finding-ids":
            return tool({
                description: candidate.description,
                inputSchema: z.object({ findingIds: z.string().min(1) }),
                execute: ({ findingIds }) => execute(candidate.capability, { findingIds })
            });
        case "capability-query":
            return tool({
                description: candidate.description,
                inputSchema: z.object({ query: z.string().min(1) }),
                execute: ({ query }) => execute(candidate.capability, { query })
            });
        case "none":
            return tool({
                description: candidate.description,
                inputSchema: z.object({}),
                execute: () => execute(candidate.capability, {})
            });
        default: {
            const _exhaustive: never = candidate.input;
            return _exhaustive;
        }
    }
}


export function createAssistantTools(request: EditorialAssistantRequest, execute: AssistantToolExecutor): ToolSet {
    return {
        ...Object.fromEntries(request.tools.map((candidate) => [candidate.capability, createAssistantTool(candidate, execute)])),
        load_skill: tool({
            description: "Load the full instructions for one relevant Skladno Skill.",
            inputSchema: z.object({ id: z.string().min(1) }),
            execute: ({ id }) => request.skills.find((skill) => skill.id === id)?.instructions ?? "Unknown Skill.",
        }),
    };
}


export function assistantStepOptions(stepNumber: number, activeCapabilities?: readonly string[]): { activeTools: string[]; toolChoice?: { type: "tool"; toolName: string } } {
    const activeTools = activeCapabilities ? [...activeCapabilities, "find_capabilities", "load_skill"] : ["find_capabilities", "load_skill"];
    const requiredCapability = activeCapabilities?.[0];

    return stepNumber === 0 && requiredCapability
        ? { activeTools, toolChoice: { type: "tool", toolName: requiredCapability } }
        : { activeTools };
}


export function assistantConversationPrompt(request: Pick<EditorialAssistantRequest, "article" | "history" | "message" | "scope">): ModelMessage[] {
    return [
        ...request.history.map((turn): ModelMessage => ({ role: turn.role === "author" ? "user" : "assistant", content: turn.content })),
        {
            role: "user",
            content: `Author request:\n${request.message}\n\n${request.scope === "selection" ? "Selected Article context" : "Current Article context"}:\n${boundedArticleContext(request.article)}`,
        },
    ];
}
