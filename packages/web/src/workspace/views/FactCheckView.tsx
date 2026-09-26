import { useId, useRef, useState } from "react";
import { FACT_CHECK_STATUS, type ArticleRevision, type FactCheck, type FactCheckFinding, type GeneralSettings } from "@skladno/shared";
import { Badge, Banner, Button, EmptyState, IconButton, Status } from "../../ui/primitives.js";
import { ChevronDownIcon, ChevronRightIcon, UpdateIcon } from "../../ui/icons.js";
import { useIntl } from "react-intl";
import { formatDateTime } from "../../i18n/formatting.js";
import { getProvenanceMessageId } from "./revision-history-presentation.js";

const tone = {
    [FACT_CHECK_STATUS.SUPPORTED]: "success",
    [FACT_CHECK_STATUS.DISPUTED]: "error",
    [FACT_CHECK_STATUS.UNVERIFIABLE]: "warning",
} as const;
const quietScrollbar = "[scrollbar-color:var(--color-border-strong)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-button]:hidden [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border-strong";


interface FactCheckData {
    factCheck: FactCheck | undefined;
    currentRevisionId?: string;
    revisions?: ArticleRevision[];
    runs?: FactCheck[];
    selectedRun?: number;
    revisionNumber?: number;
    reusedRevisionNumbers?: Record<string, number>;
    stale: boolean;
    historical?: boolean;
    generalSettings?: GeneralSettings;
}


interface FactCheckActions {
    runAgain: () => void;
    selectRun?: (index: number | undefined) => void;
    resolve: (findingId: string, resolution: NonNullable<FactCheckFinding["resolution"]>) => Promise<void>;
    proposeCorrections: (findings: FactCheckFinding[]) => void;
}


export function FactCheckView({ data, actions }: { data: FactCheckData; actions: FactCheckActions }) {
    const { factCheck, currentRevisionId, revisions = [], runs = [], selectedRun, revisionNumber, reusedRevisionNumbers, stale, historical, generalSettings } = data;
    const { runAgain, selectRun, resolve, proposeCorrections } = actions;
    const intl = useIntl();
    const [selected, setSelected] = useState(new Set<string>());
    const [activeFindingId, setActiveFindingId] = useState<string>();
    const [historyOpen, setHistoryOpen] = useState(false);
    const historyTrigger = useRef<HTMLButtonElement>(null);
    const historyMenuId = useId();
    const findingElements = useRef<Record<string, HTMLElement | null>>({});
    const findingDetails = useRef<HTMLDivElement>(null);
    const findingNavigation = useRef<(HTMLElement | null)[]>([]);
    const revisionLabel = (revisionId: string) => intl.formatMessage({ id: "views.revisionNumber" }, { revisionNumber: reusedRevisionNumbers?.[revisionId] ?? revisionNumber ?? "—" });
    const currentRevision = revisions.find((revision) => revision.id === currentRevisionId);
    const currentRevisionLabel = currentRevision
        ? `${intl.formatMessage({ id: "views.revisionNumber" }, { revisionNumber: revisions.indexOf(currentRevision) + 1 })} · ${currentRevision.description ?? intl.formatMessage({ id: getProvenanceMessageId(currentRevision, revisions) })}`
        : intl.formatMessage({ id: "views.factCheckCurrent" });
    const currentRunIndex = currentRevisionId ? runs.findIndex((run) => run.reviewedRevisionId === currentRevisionId) : -1;
    const formatCheckedAt = (checkedAt: string) => generalSettings
        ? formatDateTime(checkedAt, generalSettings.interfaceLocale, generalSettings.dateFormat, generalSettings.timeFormat, generalSettings.timeZone)
        : intl.formatDate(new Date(checkedAt), { dateStyle: "medium", timeStyle: "short" });
    const runOptionLabel = (run: FactCheck) => intl.formatMessage({ id: "views.factCheckRunOption" }, { revision: revisionLabel(run.reviewedRevisionId ?? ""), dateTime: run.createdAt ? formatCheckedAt(run.createdAt) : "—" });
    const selectedHistoryRun = selectedRun === undefined ? undefined : runs[selectedRun];
    const selectRunOption = (index: number | undefined) => {
        selectRun?.(index);
        setHistoryOpen(false);
        historyTrigger.current?.focus();
    };
    const focusHistoryOption = (last: boolean) => requestAnimationFrame(() => {
        const items = document.getElementById(historyMenuId)?.querySelectorAll<HTMLButtonElement>("[role^=menuitem]");
        items?.[last ? items.length - 1 : 0]?.focus();
    });
    const runSelector = runs.length > 0 && selectRun && <div className="relative flex max-w-full justify-end self-end">
        <Button ref={historyTrigger} type="button" variant="secondary" compact className="!self-end inline-flex max-w-full items-center gap-2 !text-muted text-xs" aria-label={intl.formatMessage({ id: "views.factCheckHistory" })} aria-controls={historyOpen ? historyMenuId : undefined} aria-expanded={historyOpen} aria-haspopup="menu" onClick={() => setHistoryOpen((open) => !open)} onKeyDown={(event) => {
            if (event.key === "Escape")
                setHistoryOpen(false);

            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                setHistoryOpen(true);
                focusHistoryOption(event.key === "ArrowUp");
            }
        }}>
            <span className="truncate" title={selectedHistoryRun ? runOptionLabel(selectedHistoryRun) : currentRevisionLabel}>{selectedHistoryRun ? runOptionLabel(selectedHistoryRun) : currentRevisionLabel}</span>
            <ChevronDownIcon className={`size-3 shrink-0 transition-transform duration-150 motion-reduce:transition-none ${historyOpen ? "rotate-180" : ""}`} />
        </Button>
        {historyOpen && <div id={historyMenuId} className="absolute right-0 top-full z-20 mt-1 max-h-72 w-[min(24rem,calc(100vw-2rem))] overflow-y-auto rounded-control border border-border bg-surface-raised p-1 shadow-raised" role="menu" aria-label={intl.formatMessage({ id: "views.factCheckHistory" })} onKeyDown={(event) => {
            const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("[role^=menuitem]")];
            const index = document.activeElement instanceof HTMLButtonElement ? items.indexOf(document.activeElement) : -1;
            const next = event.key === "ArrowDown" ? index + 1 : event.key === "ArrowUp" ? index - 1 : event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : undefined;
            if (event.key === "Escape") {
                event.preventDefault();
                setHistoryOpen(false);
                historyTrigger.current?.focus();
            } else if (next !== undefined) {
                event.preventDefault();
                items[(next + items.length) % items.length]?.focus();
            }
        }}>
            <button className="flex min-h-9 w-full items-center gap-2 rounded-control px-2 py-1 text-left text-xs text-ink hover:bg-brand-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-brand" type="button" role="menuitemradio" aria-checked={selectedRun === undefined} onClick={() => selectRunOption(undefined)}>
                <span className="grid size-5 shrink-0 place-items-center rounded-full border border-border bg-surface-raised text-brand"><UpdateIcon className="size-3" /></span>
                <span className="min-w-0 flex-1 truncate" title={currentRevisionLabel}>{currentRevisionLabel}</span>
                <span className="text-micro font-semibold text-muted">{intl.formatMessage({ id: "revisions.current" })}</span>
            </button>
            {runs.map((run, index) => index !== currentRunIndex && <button key={index} className="flex min-h-9 w-full items-center gap-2 rounded-control px-2 py-1 text-left text-xs text-ink hover:bg-brand-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-brand" type="button" role="menuitemradio" aria-checked={selectedRun === index} onClick={() => selectRunOption(index)}>
                <span className="grid size-5 shrink-0 place-items-center rounded-full border border-border bg-surface-raised text-brand"><UpdateIcon className="size-3" /></span>
                <span className="font-semibold">{revisionLabel(run.reviewedRevisionId ?? "")}</span>
                <span className="min-w-0 flex-1 truncate" title={runOptionLabel(run)}>{run.createdAt ? formatCheckedAt(run.createdAt) : "—"}</span>
            </button>)}
        </div>}
    </div>;

    if (!factCheck)
        return <div className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col gap-4">
            {runSelector}
            <EmptyState title={intl.formatMessage({ id: "views.factCheckEmptyTitle" })}>{intl.formatMessage({ id: "views.factCheckEmpty" })}
                <Button onClick={runAgain}>{intl.formatMessage({ id: "views.runFactCheck" })}</Button>
            </EmptyState>
        </div>;

    const isStale = (finding: FactCheckFinding) => stale || historical || finding.stale === true;
    const eligible = factCheck.findings.filter((finding) => !isStale(finding)
        && !finding.resolution
        && (finding.status === FACT_CHECK_STATUS.DISPUTED || finding.status === FACT_CHECK_STATUS.UNVERIFIABLE)
        && finding.occurrenceId
    );
    const toggle = (id: string) => setSelected((current) => {
        const next = new Set(current);
        if (next.has(id))
            next.delete(id);
        else
            next.add(id);

        return next;
    });
    const selectedFindings = eligible.filter((finding) => selected.has(finding.occurrenceId!));
    const selectFinding = (finding: FactCheckFinding, toggleSelection = true) => {
        const id = finding.occurrenceId ?? finding.claim;
        setActiveFindingId(id);
        const detail = findingElements.current[id];
        if (detail)
            detail.scrollIntoView({ behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });

        if (toggleSelection && finding.occurrenceId && eligible.some((item) => item.occurrenceId === finding.occurrenceId))
            toggle(finding.occurrenceId);
    };
    const moveFinding = (direction: -1 | 1) => {
        const currentIndex = factCheck.findings.findIndex((finding) => (finding.occurrenceId ?? finding.claim) === activeFindingId);
        const nextIndex = currentIndex < 0 ? (direction === 1 ? 0 : factCheck.findings.length - 1) : (currentIndex + direction + factCheck.findings.length) % factCheck.findings.length;
        const finding = factCheck.findings[nextIndex];
        if (finding)
            selectFinding(finding, false);

        findingNavigation.current[nextIndex]?.focus({ preventScroll: true });
    };
    const getResolutionMessage = (resolution: NonNullable<FactCheckFinding["resolution"]>) => intl.formatMessage({ id: `views.factResolution.${resolution}` as never });
    return <div className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col">
        <header className="shrink-0 border-b border-border bg-canvas">
            <div className="mx-auto flex w-full max-w-6xl flex-wrap items-start justify-between gap-x-6 gap-y-3 px-5 py-4">
                <div>
                    <h2 className="text-base font-semibold">{intl.formatMessage({ id: "views.factCheck" })}</h2>
                    <p className="text-xs text-muted">{intl.formatMessage({ id: "views.factCheckRevision" }, { revision: revisionNumber === undefined ? "—" : revisionLabel(factCheck.reviewedRevisionId ?? "") })}</p>
                </div>
                <div className="ml-auto flex w-max max-w-full flex-col gap-2">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                        {factCheck.findings.length > 1 && <nav className="flex gap-1" aria-label={intl.formatMessage({ id: "views.findingNavigation" })}>
                            <IconButton variant="quiet" label={intl.formatMessage({ id: "views.previousFinding" })} title={intl.formatMessage({ id: "views.previousFinding" })} onClick={() => moveFinding(-1)}><ChevronRightIcon className="size-4 rotate-180" /></IconButton>
                            <IconButton variant="quiet" label={intl.formatMessage({ id: "views.nextFinding" })} title={intl.formatMessage({ id: "views.nextFinding" })} onClick={() => moveFinding(1)}><ChevronRightIcon className="size-4" /></IconButton>
                        </nav>}
                        <Button variant="secondary" onClick={runAgain}>{intl.formatMessage({ id: "views.runFactCheckAgain" })}</Button>
                        {eligible.length > 0 && <>
                            <Button variant="secondary" onClick={() => setSelected(new Set(eligible.map((finding) => finding.occurrenceId!)))}>{intl.formatMessage({ id: "views.selectAllNeedingReview" })}</Button>
                            <Button disabled={selectedFindings.length === 0} onClick={() => proposeCorrections(selectedFindings)}>{intl.formatMessage({ id: "views.proposeFactCorrections" }, { count: selectedFindings.length })}</Button>
                        </>}
                    </div>
                    {runSelector && <div className="flex w-full justify-end"><div className="w-64">{runSelector}</div></div>}
                </div>
            </div>
        </header>
        {stale && <Banner className="mt-4" tone="warning"><span>{intl.formatMessage({ id: "views.factCheckStale" })}</span></Banner>}
        {factCheck.incomplete && <Banner className="mt-4" tone="warning"><span>{intl.formatMessage({ id: "views.factCheckIncomplete" })}</span></Banner>}
        {!stale && historical && <Banner className="mt-4" tone="warning">
            <span>{intl.formatMessage({ id: "views.factCheckHistorical" })}</span>
        </Banner>}
        {factCheck.findings.some((finding) => finding.checkedAt || finding.sources.some((source) => source.publishedAt)) && <p className="mt-2 text-xs text-muted">{intl.formatMessage({ id: "views.factEvidenceFreshness" })}</p>}
        <div className="mt-4 grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(15rem,0.7fr)_minmax(0,1.3fr)]">
            <aside aria-label={intl.formatMessage({ id: "views.factCheckFindings" })} className={`divide-y divide-border overflow-y-auto rounded-panel border border-border ${quietScrollbar}`}>{factCheck.findings.map((finding) => {
                const id = finding.occurrenceId ?? finding.claim;
                const active = activeFindingId === id;
                return <button type="button" key={id} className={`block w-full border-l-2 p-3 text-left text-sm hover:bg-brand-soft ${active ? "border-brand bg-brand-soft" : "border-transparent"}`} aria-current={active || undefined} onClick={() => selectFinding(finding)}>
                    <span className={`block font-semibold ${finding.resolution ? "text-muted" : ""}`}>{finding.claim}</span>
                    <Badge className="mt-2 !rounded-control border" tone={tone[finding.status]}>{intl.formatMessage({ id: `views.factStatus.${finding.status}` })}</Badge>
                </button>;
            })}</aside>
            <div ref={findingDetails} className={`space-y-3 overflow-y-auto pr-1 ${quietScrollbar}`}>{factCheck.findings.map((finding, index) => {
                const id = finding.occurrenceId ?? finding.claim;
                return <article className="scroll-mt-4 rounded-panel border border-border bg-surface-raised p-4" key={id} tabIndex={-1} ref={(element) => {
                    findingElements.current[id] = element;
                    findingNavigation.current[index] = element;
                }}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <Status compact label={intl.formatMessage({ id: `views.factStatus.${finding.status}` })} tone={tone[finding.status]}>
                            {finding.importance && <span className="ml-2">{intl.formatMessage({ id: "views.factImportance" }, { importance: finding.importance })}</span>}
                            {finding.resolution && <span className="ml-2">{getResolutionMessage(finding.resolution)}</span>}
                        </Status>
                        {!finding.resolution
                            && !isStale(finding)
                            && finding.occurrenceId && <div className="flex flex-wrap gap-2">{(finding.status === FACT_CHECK_STATUS.DISPUTED || finding.status === FACT_CHECK_STATUS.UNVERIFIABLE)
                                && <Button onClick={() => proposeCorrections([finding])}>{intl.formatMessage({ id: "views.proposeFactCorrection" })}</Button>}
                        <Button variant="secondary" onClick={() => void resolve(finding.occurrenceId!, "accepted_as_written")}>{intl.formatMessage({ id: "views.acceptFactAsWritten" })}</Button>
                        <Button variant="secondary" onClick={() => void resolve(finding.occurrenceId!, "evidence_accepted")}>{intl.formatMessage({ id: "views.acceptFactEvidence" })}</Button>
                        </div>
                        }
                    </div>
                    {finding.reusedFromRevisionId && <p className="mt-2 text-sm text-muted">{intl.formatMessage({ id: "views.factEvidenceReused" }, { revision: revisionLabel(finding.reusedFromRevisionId) })}</p>}
                    {finding.checkedAt && <p className="mt-2 text-sm text-muted">{intl.formatMessage({ id: "views.factCheckedAt" }, { dateTime: formatCheckedAt(finding.checkedAt) })}</p>}
                    <h3 className="mt-4 font-editor text-lg">{finding.claim}</h3>
                    <p className="mt-3">{finding.rationale}</p>
                    <p className="mt-2 text-sm text-muted">{intl.formatMessage({ id: "views.uncertainty" }, { value: finding.uncertainty })}</p>
                    <div className="mt-4 space-y-2">
                        {finding.sources.map((source) => <a className="block px-3 py-1.5 text-sm text-brand underline" key={source.url} href={source.url} title={source.url} target="_blank" rel="noreferrer">
                            <strong>{source.title}</strong>
                            <span className="ml-2 text-muted">{source.quality}{source.publishedAt ? ` · ${source.publishedAt}` : ""}</span>
                        </a>)}
                    </div>
                </article>;
            })}</div>
        </div>
    </div>;
}
