import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";

import type { ArticleTitleGenerator } from "../../application/ports/article-title-generator.js";


/** OpenAI implementation of the provider-neutral title-generator port. */
export class OpenAiArticleTitleGeneratorAdapter implements ArticleTitleGenerator {
    private readonly openai;


    constructor(apiKey: string, private readonly model: string) {
        this.openai = createOpenAI({ apiKey });
    }


    async generate(content: string, signal: AbortSignal): Promise<string> {
        const result = await generateText({
            model: this.openai.responses(this.model),
            prompt: `Name this writing sample in 2 to 6 neutral words. Return only the name, without quotation marks or punctuation.\n\n${content.slice(0, 12000)}`,
            abortSignal: signal,
            telemetry: { isEnabled: false },
            providerOptions: { openai: { store: false } },
        });

        return result.text.trim().replace(/^['"“”]+|['"“”]+$/g, "").replace(/\s+/g, " ").slice(0, 120);
    }
}
