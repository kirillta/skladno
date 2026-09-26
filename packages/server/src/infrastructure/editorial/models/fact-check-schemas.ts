import { z } from "zod";
import { FACT_CHECK_STATUS } from "@skladno/shared";

export const claimSchema = z.object({ claim: z.string().min(1) });

export const findingSchema = z.object({
    claim: z.string().min(1),
    status: z.enum([FACT_CHECK_STATUS.SUPPORTED, FACT_CHECK_STATUS.DISPUTED, FACT_CHECK_STATUS.UNVERIFIABLE]),
    rationale: z.string().min(1),
    uncertainty: z.string().min(1),
    sources: z.array(z.object({
        // Validate locally: provider structured output rejects JSON Schema's URI format.
        url: z.string().refine((value) => URL.canParse(value), "Invalid URL"),
        title: z.string().min(1),
        excerpt: z.string().min(1).nullable(),
        quality: z.enum(["primary", "credible", "secondary", "unknown"]),
        publishedAt: z.string().nullable(),
    })).max(5),
});
