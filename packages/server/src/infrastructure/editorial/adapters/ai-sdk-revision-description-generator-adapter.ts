import { generateText, type LanguageModel } from "ai";

import type { RevisionDescriptionGenerator } from "../../../application/editorial/revision-description-generator.js";
import { EDITORIAL_ENGINE_ERROR } from "../../../application/editorial/engine/editorial-engine-errors.js";
import { EditorialEngineError } from "../../../application/editorial/engine/editorial-engine-error.js";
import { createAiSdkGenerationOptions, isAcceptedFinish, type SupportingTextProviderOptions } from "./ai-sdk-provider.js";


export class AiSdkRevisionDescriptionGeneratorAdapter implements RevisionDescriptionGenerator {
    constructor(private readonly model: LanguageModel, private readonly providerOptions: SupportingTextProviderOptions = undefined) { }


    async generate(previousContent: string, content: string, interfaceLocale: string, signal: AbortSignal): Promise<string> {
        const changedContext = getChangedContext(previousContent, content);
        const result = await generateText({
            ...createAiSdkGenerationOptions({ model: this.model, signal, providerOptions: this.providerOptions }),
            prompt: `Summarize this editorial change in 2 to 8 neutral words in the interface locale ${interfaceLocale}, regardless of the Article language. Return only the summary, without quotation marks or ending punctuation. Do not invent facts.\n\nRemoved text:\n${changedContext.removed}\n\nAdded text:\n${changedContext.added}`,
        });
        const description = result.text.trim().replace(/^['"“”]+|['"“”]+$/g, "").replace(/\s+/g, " ").slice(0, 120);
        if (!isAcceptedFinish(result.finishReason) || !description)
            throw new EditorialEngineError(EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT, EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT);

        return description;
    }
}


function getChangedContext(previousContent: string, content: string): { removed: string; added: string } {
    let start = 0;
    while (start < previousContent.length && start < content.length && previousContent[start] === content[start])
        start += 1;

    let previousEnd = previousContent.length;
    let contentEnd = content.length;
    while (previousEnd > start && contentEnd > start && previousContent[previousEnd - 1] === content[contentEnd - 1]) {
        previousEnd -= 1;
        contentEnd -= 1;
    }

    return { removed: previousContent.slice(start, previousEnd).slice(0, 12000), added: content.slice(start, contentEnd).slice(0, 12000) };
}
