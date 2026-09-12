import { z } from "zod";
import { type StyleProfile, type StyleReview } from "@skladno/shared";

import { EDITORIAL_ENGINE_ERROR } from "../../../application/errors/editorial-engine-errors.js";
import { EditorialEngineError } from "../../../application/errors/editorial-engine-error.js";

export const styleReviewSchema = z.object({
    proposal: z.string().min(1),
    findings: z.array(z.object({
        divergence: z.string().min(1),
        suggestion: z.string().min(1),
        traitIds: z.array(z.string().min(1)).min(1),
    })),
});

export const translationSchema = z.object({
    translation: z.string().min(1),
    title: z.string(),
    targetLanguage: z.string().min(1),
});


export function styleReview(value: z.infer<typeof styleReviewSchema>, profile: StyleProfile, articleRules = ""): StyleReview {
    const availableTraits = new Set([
        ...profile.traits.map((trait) => trait.id),
        ...profile.rules.split("\n").filter(Boolean).map((_rule, index) => `global-rule-${index + 1}`),
        ...articleRules.split("\n").filter(Boolean).map((_rule, index) => `article-rule-${index + 1}`)
    ]);
    if (value.findings.some((finding) => finding.traitIds.some((traitId) => !availableTraits.has(traitId))))
        throw new EditorialEngineError(EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT, EDITORIAL_ENGINE_ERROR.INVALID_OUTPUT);

    return {
        findings: value.findings,
        profileVersion: profile.version,
        confidence: profile.confidence,
        traitLabels: Object.fromEntries([
            ...profile.traits.map((trait) => [trait.id, trait.label]),
            ...profile.rules.split("\n").filter(Boolean).map((rule, index) => [`global-rule-${index + 1}`, rule]),
            ...articleRules.split("\n").filter(Boolean).map((rule, index) => [`article-rule-${index + 1}`, rule])
        ]),
        globalRules: profile.rules.split("\n").filter(Boolean),
        articleRules: articleRules.split("\n").filter(Boolean),
    };
}
