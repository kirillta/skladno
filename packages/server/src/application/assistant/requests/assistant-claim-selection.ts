import { APPLICATION_ERROR, HTTP_STATUS, type FactCheckClaimPreview } from "@skladno/shared";

import { ApplicationServiceError } from "../../errors/application-service-error.js";


export class AssistantClaimSelection {
    private readonly active = new Map<string, { articleId: string; skipped: Set<string>; pending: Set<string> }>();


    start(articleId: string, requestId: string): (claim: string) => boolean {
        const selection = { articleId, skipped: new Set<string>(), pending: new Set<string>() };
        this.active.set(requestId, selection);
        return (claim) => selection.skipped.has(claim);
    }


    updateClaims(requestId: string, claims: FactCheckClaimPreview[]): void {
        const selection = this.active.get(requestId);
        if (selection)
            selection.pending = new Set(claims.filter(({ checked, claim }) => !checked || selection.skipped.has(claim)).map(({ claim }) => claim));
    }


    setSelected(articleId: string, requestId: string, claim: string, selected: boolean): void {
        const selection = this.active.get(requestId);
        if (!selection || selection.articleId !== articleId || !selection.pending.has(claim) || !claim.trim() || claim.length > 2000)
            throw new ApplicationServiceError(APPLICATION_ERROR.INVALID_REQUEST, HTTP_STATUS.BAD_REQUEST);

        if (selected)
            selection.skipped.delete(claim);
        else
            selection.skipped.add(claim);
    }


    finish(requestId: string): void {
        this.active.delete(requestId);
    }
}
