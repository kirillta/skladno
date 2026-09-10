import { generateText, type LanguageModel } from "ai";

import type { ArticleTitleGenerator } from "../../application/ports/article-title-generator.js";
import { EDITORIAL_ENGINE_ERROR } from "../../application/ports/editorial-engine-errors.js";
import { EditorialEngineError } from "../../application/ports/editorial-engine-error.js";
import { aiSdkGenerationOptions, isAcceptedFinish, type SupportingTextProviderOptions } from "./ai-sdk-provider.js";


/** Provider-neutral AI SDK implementation of the title-generator port. */
export class AiSdkArticleTitleGeneratorAdapter implements ArticleTitleGenerator {
    constructor(private readonly model: LanguageModel, private readonly providerOptions: SupportingTextProviderOptions = undefined) { }


    async generate(content: string, signal: AbortSignal): Promise<string> {
        const result = await generateText({
            ...aiSdkGenerationOptions({ model: this.model, signal, providerOptions: this.providerOptions }),
            prompt: `Name this writing sample in 2 to 6 neutral words. Return only the name, without quotation marks or punctuation.\n\n${content.slice(0, 12000)}`,
        });

        if (!isAcceptedFinish(result.finishReason))
            throw new EditorialEngineError(EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT, EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT);

        return result.text.trim().replace(/^['"“”]+|['"“”]+$/g, "").replace(/\s+/g, " ").slice(0, 120);
    }
}
