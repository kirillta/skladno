import { useRef, useState } from "react";
import { FACT_CHECK_STATUS, type FactCheck, type FactCheckFinding } from "@skladno/shared";
import { Badge, Banner, Button, EmptyState, Status } from "../../ui/primitives.js";
import { useIntl } from "react-intl";

const tone = {
    [FACT_CHECK_STATUS.SUPPORTED]: "success",
    [FACT_CHECK_STATUS.DISPUTED]: "error",
    [FACT_CHECK_STATUS.UNVERIFIABLE]: "warning",
} as const;
const quietScrollbar = "[scrollbar-color:var(--color-border-strong)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-button]:hidden [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border-strong";


export function FactCheckView({ factCheck, revisionNumber, reusedRevisionNumbers, stale, runAgain, resolve, proposeCorrections }: {
    factCheck: FactCheck | undefined;
    revisionNumber?: number;
    reusedRevisionNumbers?: Record<string, number>;
    stale: boolean;
    runAgain: () => void;
    resolve: (findingId: string, resolution: NonNullable<FactCheckFinding["resolution"]>) => Promise<void>;
    proposeCorrections: (findings: FactCheckFinding[]) => void;
}) {
    const intl = useIntl();
    const [selected, setSelected] = useState(new Set<string>());
    const [activeFindingId, setActiveFindingId] = useState<string>();
    const findingElements = useRef<Record<string, HTMLElement | null>>({});
    const findingDetails = useRef<HTMLDivElement>(null);
    if (!factCheck)
        return <EmptyState title={intl.formatMessage({ id: "views.factCheckEmptyTitle" })}>{intl.formatMessage({ id: "views.factCheckEmpty" })}<Button onClick={runAgain}>{intl.formatMessage({ id: "views.runFactCheck" })}</Button></EmptyState>;

    const isStale = (finding: FactCheckFinding) => stale && finding.stale !== false;
    const eligible = factCheck.findings.filter((finding) => !isStale(finding) && !finding.resolution && (finding.status === FACT_CHECK_STATUS.DISPUTED || finding.status === FACT_CHECK_STATUS.UNVERIFIABLE) && finding.occurrenceId);
    const toggle = (id: string) => setSelected((current) => {
        const next = new Set(current);
        if (next.has(id))
            next.delete(id);
        else
            next.add(id);

        return next;
    });
    const selectedFindings = eligible.filter((finding) => selected.has(finding.occurrenceId!));
    const selectFinding = (finding: FactCheckFinding) => {
        const id = finding.occurrenceId ?? finding.claim;
        setActiveFindingId(id);
        const detail = findingElements.current[id];
        if (detail)
            findingDetails.current?.scrollTo({ top: detail.offsetTop, behavior: "smooth" });

        if (finding.occurrenceId && eligible.some((item) => item.occurrenceId === finding.occurrenceId))
            toggle(finding.occurrenceId);
    };
    const resolutionMessage = (resolution: NonNullable<FactCheckFinding["resolution"]>) => intl.formatMessage({ id: `views.factResolution.${resolution}` as never });
    const revisionLabel = (revisionId: string) => intl.formatMessage({ id: "views.revisionNumber" }, { revisionNumber: reusedRevisionNumbers?.[revisionId] ?? revisionNumber ?? "—" });

    return <div className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col">
        <div className="shrink-0 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">{intl.formatMessage({ id: "views.factCheck" })}</h2><p className="text-sm text-muted">{intl.formatMessage({ id: "views.factCheckRevision" }, { revision: revisionNumber === undefined ? "—" : revisionLabel(factCheck.reviewedRevisionId ?? "") })}</p></div><div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={runAgain}>{intl.formatMessage({ id: "views.runFactCheckAgain" })}</Button>{eligible.length > 0 && <><Button variant="secondary" onClick={() => setSelected(new Set(eligible.map((finding) => finding.occurrenceId!)))}>{intl.formatMessage({ id: "views.selectAllNeedingReview" })}</Button><Button disabled={selectedFindings.length === 0} onClick={() => proposeCorrections(selectedFindings)}>{intl.formatMessage({ id: "views.proposeFactCorrections" }, { count: selectedFindings.length })}</Button></>}</div></div>
        {stale && <Banner className="mt-4" tone="warning"><span>{intl.formatMessage({ id: "views.factCheckStale" })}</span></Banner>}
        <div className="mt-4 grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(15rem,0.7fr)_minmax(0,1.3fr)]">
            <aside aria-label={intl.formatMessage({ id: "views.factCheckFindings" })} className={`divide-y divide-border overflow-y-auto rounded-panel border border-border ${quietScrollbar}`}>{factCheck.findings.map((finding) => {
                const id = finding.occurrenceId ?? finding.claim;
                const active = activeFindingId === id;
                return <button type="button" key={id} className={`block w-full border-l-2 p-3 text-left text-sm hover:bg-brand-soft ${active ? "border-brand bg-brand-soft" : "border-transparent"}`} aria-current={active || undefined} onClick={() => selectFinding(finding)}>
                    <span className={`block font-semibold ${finding.resolution ? "text-muted" : ""}`}>{finding.claim}</span>
                    <Badge className="mt-2 !rounded-control border" tone={tone[finding.status]}>{intl.formatMessage({ id: `views.factStatus.${finding.status}` })}</Badge>
                </button>;
            })}</aside>
            <div ref={findingDetails} className={`space-y-3 overflow-y-auto pr-1 ${quietScrollbar}`}>{factCheck.findings.map((finding) => {
                const id = finding.occurrenceId ?? finding.claim;
                return <article className="scroll-mt-4 rounded-panel border border-border bg-surface-raised p-4" key={id} ref={(element) => {
                    findingElements.current[id] = element;
                }}>
                    <div className="flex flex-wrap items-start justify-between gap-3"><Status compact label={intl.formatMessage({ id: `views.factStatus.${finding.status}` })} tone={tone[finding.status]}>{finding.importance && <span className="ml-2">{intl.formatMessage({ id: "views.factImportance" }, { importance: finding.importance })}</span>}{finding.resolution && <span className="ml-2">{resolutionMessage(finding.resolution)}</span>}</Status>{!finding.resolution && !isStale(finding) && finding.occurrenceId && <div className="flex flex-wrap gap-2">{(finding.status === FACT_CHECK_STATUS.DISPUTED || finding.status === FACT_CHECK_STATUS.UNVERIFIABLE) && <Button onClick={() => proposeCorrections([finding])}>{intl.formatMessage({ id: "views.proposeFactCorrection" })}</Button>}<Button variant="secondary" onClick={() => void resolve(finding.occurrenceId!, "accepted_as_written")}>{intl.formatMessage({ id: "views.acceptFactAsWritten" })}</Button><Button variant="secondary" onClick={() => void resolve(finding.occurrenceId!, "evidence_accepted")}>{intl.formatMessage({ id: "views.acceptFactEvidence" })}</Button></div>}</div>
                    {finding.reusedFromRevisionId && <p className="mt-2 text-sm text-muted">{intl.formatMessage({ id: "views.factEvidenceReused" }, { revision: revisionLabel(finding.reusedFromRevisionId) })}</p>}
                    <h3 className="mt-4 font-editor text-lg">{finding.claim}</h3><p className="mt-3">{finding.rationale}</p><p className="mt-2 text-sm text-muted">{intl.formatMessage({ id: "views.uncertainty" }, { value: finding.uncertainty })}</p>
                    <div className="mt-4 space-y-2">{finding.sources.map((source) => <a className="block px-3 py-1.5 text-sm text-brand underline" key={source.url} href={source.url} target="_blank" rel="noreferrer"><strong>{source.title}</strong><span className="ml-2 text-muted">{source.quality}{source.publishedAt ? ` · ${source.publishedAt}` : ""}</span></a>)}</div>
                </article>;
            })}</div>
        </div>
    </div>;
}
