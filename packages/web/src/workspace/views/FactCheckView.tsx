import type { FactCheck } from "@skladno/shared";
import { EmptyState } from "../../ui/primitives.js";
import { useIntl } from "react-intl";

export function FactCheckView({ factCheck }: { factCheck: FactCheck | undefined }) {
    const intl = useIntl();
    if (!factCheck)
        return <EmptyState title={intl.formatMessage({ id: "views.factCheckEmptyTitle" })}>{intl.formatMessage({ id: "views.factCheckEmpty" })}</EmptyState>;

    return <div>
        <h2 className="font-semibold">{intl.formatMessage({ id: "views.factCheck" })}</h2>
        {factCheck.findings.map((finding) => <article className="mt-3 rounded-control border border-border p-3" key={finding.claim}>
            <strong>{finding.claim}</strong>
            <p>{finding.rationale}</p>
            <p className="text-sm text-muted">{intl.formatMessage({ id: "views.uncertainty" }, { value: finding.uncertainty })}</p>
            {finding.sources.map((source) => <a className="block text-sm text-brand underline" key={source.url} href={source.url}>{source.title}</a>)}
        </article>)}
    </div>;
}
