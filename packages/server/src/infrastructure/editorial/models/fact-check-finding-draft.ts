import type { FactCheckFinding } from "@skladno/shared";


export interface FactCheckFindingDraft {
    claim: string;
    status: FactCheckFinding["status"];
    rationale: string;
    uncertainty: string;
    sources: {
        url: string;
        title: string;
        excerpt: string | null;
        quality: FactCheckFinding["sources"][number]["quality"];
        publishedAt: string | null;
    }[];
}
