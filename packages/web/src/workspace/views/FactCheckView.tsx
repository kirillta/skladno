import type { FactCheck } from "@skladno/shared";
import { EmptyState } from "../../ui/primitives.js";

export function FactCheckView({ factCheck }: { factCheck: FactCheck | undefined }) {
    if (!factCheck)
        return <EmptyState title="No fact-check findings">Fact checks are advisory and never change the article.</EmptyState>;

    return <div>
        <h2 className="font-semibold">Fact Check</h2>
        {factCheck.findings.map((finding) => <article className="mt-3 rounded-control border border-border p-3" key={finding.claim}>
            <strong>{finding.claim}</strong>
            <p>{finding.rationale}</p>
            <p className="text-sm text-muted">Uncertainty: {finding.uncertainty}</p>
            {finding.sources.map((source) => <a className="block text-sm text-brand underline" key={source.url} href={source.url}>{source.title}</a>)}
        </article>)}
    </div>;
}
