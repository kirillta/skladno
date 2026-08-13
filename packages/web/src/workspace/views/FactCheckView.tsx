import { useState } from "react";
import { FACT_CHECK_STATUS, type FactCheck, type FactCheckFinding } from "@skladno/shared";
import { Banner, Button, EmptyState, Status } from "../../ui/primitives.js";
import { useIntl } from "react-intl";

const tone = {
    [FACT_CHECK_STATUS.SUPPORTED]: "success",
    [FACT_CHECK_STATUS.DISPUTED]: "error",
    [FACT_CHECK_STATUS.UNVERIFIABLE]: "warning",
} as const;


export function FactCheckView({ factCheck, revisionNumber, stale, runAgain, resolve, proposeCorrections }: {
    factCheck: FactCheck | undefined;
    revisionNumber?: number;
    stale: boolean;
    runAgain: () => void;
    resolve: (findingId: string, resolution: NonNullable<FactCheckFinding["resolution"]>) => Promise<void>;
    proposeCorrections: (findings: FactCheckFinding[]) => void;
}) {
    const intl = useIntl();
    const [selected, setSelected] = useState(new Set<string>());
    if (!factCheck)
        return <EmptyState title={intl.formatMessage({ id: "views.factCheckEmptyTitle" })}>{intl.formatMessage({ id: "views.factCheckEmpty" })}<Button onClick={runAgain}>{intl.formatMessage({ id: "views.runFactCheck" })}</Button></EmptyState>;

    const eligible = factCheck.findings.filter((finding) => !stale && !finding.resolution && (finding.status === FACT_CHECK_STATUS.DISPUTED || finding.status === FACT_CHECK_STATUS.UNVERIFIABLE) && finding.occurrenceId);
    const toggle = (id: string) => setSelected((current) => {
        const next = new Set(current);
        if (next.has(id))
            next.delete(id);
        else
            next.add(id);

        return next;
    });
    const selectedFindings = eligible.filter((finding) => selected.has(finding.occurrenceId!));

    return <div className="mx-auto w-full max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">{intl.formatMessage({ id: "views.factCheck" })}</h2><p className="text-sm text-muted">{intl.formatMessage({ id: "views.factCheckRevision" }, { revision: revisionNumber === undefined ? "—" : intl.formatMessage({ id: "views.revisionNumber" }, { revisionNumber }) })}</p></div><Button variant="secondary" onClick={runAgain}>{intl.formatMessage({ id: "views.runFactCheckAgain" })}</Button></div>
        {stale && <Banner className="mt-4" tone="warning"><span>{intl.formatMessage({ id: "views.factCheckStale" })}</span></Banner>}
        {!stale && eligible.length > 0 && <div className="mt-4 flex flex-wrap gap-2"><Button variant="secondary" onClick={() => setSelected(new Set(eligible.map((finding) => finding.occurrenceId!)))}>{intl.formatMessage({ id: "views.selectAllNeedingReview" })}</Button><Button disabled={selectedFindings.length === 0} onClick={() => proposeCorrections(selectedFindings)}>{intl.formatMessage({ id: "views.proposeFactCorrections" }, { count: selectedFindings.length })}</Button></div>}
        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(15rem,0.7fr)_minmax(0,1.3fr)]">
            <aside aria-label={intl.formatMessage({ id: "views.factCheckFindings" })} className="divide-y divide-border rounded-panel border border-border">{factCheck.findings.map((finding) => <button type="button" key={finding.occurrenceId ?? finding.claim} className="block w-full p-3 text-left text-sm hover:bg-brand-soft" onClick={() => finding.occurrenceId && eligible.some((item) => item.occurrenceId === finding.occurrenceId) && toggle(finding.occurrenceId)}><span className="block font-semibold">{finding.claim}</span><span className="text-muted">{intl.formatMessage({ id: `views.factStatus.${finding.status}` })}</span></button>)}</aside>
            <div className="space-y-3">{factCheck.findings.map((finding) =>
                <article className="rounded-panel border border-border bg-surface-raised p-4" key={finding.occurrenceId ?? finding.claim}>
                    <Status label={intl.formatMessage({ id: `views.factStatus.${finding.status}` })} tone={tone[finding.status]}>
                        {finding.importance && <span className="ml-2">{intl.formatMessage({ id: "views.factImportance" }, { importance: finding.importance })}</span>}
                    </Status>
                    <h3 className="mt-4 font-editor text-lg">{finding.claim}</h3>
                    <p className="mt-3">{finding.rationale}</p>
                    <p className="mt-2 text-sm text-muted">{intl.formatMessage({ id: "views.uncertainty" }, { value: finding.uncertainty })}</p>
                    {finding.reusedFromRevisionId && <p className="mt-2 text-sm text-muted">{intl.formatMessage({ id: "views.factEvidenceReused" }, { revision: finding.reusedFromRevisionId })}</p>}
                    <div className="mt-4 space-y-2">{finding.sources.map((source) =>
                        <a className="block rounded-control border border-border p-3 text-sm text-brand underline" key={source.url} href={source.url} target="_blank" rel="noreferrer">
                            <strong>{source.title}</strong>
                            <span className="ml-2 text-muted">{source.quality}{source.publishedAt ? ` · ${source.publishedAt}` : ""}</span>
                        </a>)}
                    </div>
                    {!stale && finding.occurrenceId && !finding.resolution && <div className="mt-4 flex flex-wrap gap-2">
                        {(finding.status === FACT_CHECK_STATUS.DISPUTED || finding.status === FACT_CHECK_STATUS.UNVERIFIABLE) && <Button onClick={() => proposeCorrections([finding])}>{intl.formatMessage({ id: "views.proposeFactCorrection" })}</Button>}
                        <Button variant="secondary" onClick={() => void resolve(finding.occurrenceId!, "accepted_as_written")}>{intl.formatMessage({ id: "views.acceptFactAsWritten" })}</Button>
                        <Button variant="secondary" onClick={() => void resolve(finding.occurrenceId!, "evidence_accepted")}>{intl.formatMessage({ id: "views.acceptFactEvidence" })}</Button>
                    </div>}
                    {finding.resolution && <p className="mt-3 text-sm text-muted">{intl.formatMessage({ id: "views.factResolution" }, { resolution: finding.resolution })}</p>}
                </article>)}
            </div>
        </div>
    </div>;
}
