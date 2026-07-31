import { useState } from "react";
import { IntlProvider, useIntl } from "react-intl";
import { messages } from "../../i18n/messages.js";
import { EDITORIAL_OPERATION, type EditorialOperation } from "@skladno/shared";
import { Banner, Button, Status, TextareaField } from "../../ui/primitives.js";


const editorialOperationLabels: Record<EditorialOperation, "operations.thesisToNarrative" | "operations.flowRevision" | "operations.factCheck" | "operations.styleReview" | "operations.translation"> = {
    [EDITORIAL_OPERATION.THESIS_TO_NARRATIVE]: "operations.thesisToNarrative",
    [EDITORIAL_OPERATION.FLOW_REVISION]: "operations.flowRevision",
    [EDITORIAL_OPERATION.FACT_CHECK]: "operations.factCheck",
    [EDITORIAL_OPERATION.STYLE_REVIEW]: "operations.styleReview",
    [EDITORIAL_OPERATION.TRANSLATION]: "operations.translation",
};


function AssistantMark() {
    return <svg aria-hidden="true" className="size-5 shrink-0 text-brand" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="m12 3 .9 3.1L16 7l-3.1.9L12 11l-.9-3.1L8 7l3.1-.9L12 3Zm6 8 .6 2.4L21 14l-2.4.6L18 17l-.6-2.4L15 14l2.4-.6L18 11ZM6 13l.9 3.1L10 17l-3.1.9L6 21l-.9-3.1L2 17l3.1-.9L6 13Z" />
    </svg>;
}


function CollapseMark() {
    return <svg aria-hidden="true" className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" />
    </svg>;
}


function DisclosureMark({ open }: { open: boolean }) {
    return <svg aria-hidden="true" className={`size-4 transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
    </svg>;
}


function SendMark() {
    return <svg aria-hidden="true" className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="m21 3-7.5 18-3.75-7.5L3 9l18-6Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 13.5 14.5 9" />
    </svg>;
}


export function EditorialAssistantPanel(props: {
    state: "idle" | "streaming" | "error";
    message: string;
    onRequest: (operation: EditorialOperation, guidance: string, language?: string) => Promise<void>;
    onCancel: () => void;
    collapsed: boolean;
    setCollapsed: (value: boolean) => void;
    language: string;
}) {
    return <IntlProvider locale="en" messages={messages}>
        <LocalizedEditorialAssistantPanel {...props} />
    </IntlProvider>;
}

function LocalizedEditorialAssistantPanel({ state, message, onRequest, onCancel, collapsed, setCollapsed, language }: {
    state: "idle" | "streaming" | "error";
    message: string;
    onRequest: (operation: EditorialOperation, guidance: string, language?: string) => Promise<void>;
    onCancel: () => void;
    collapsed: boolean;
    setCollapsed: (value: boolean) => void;
    language: string;
}) {
    const intl = useIntl();
    const [guidance, setGuidance] = useState("");
    const [quickActionsOpen, setQuickActionsOpen] = useState(false);
    const [selectedOperation, setSelectedOperation] = useState<EditorialOperation>();

    function selectOperation(operation: EditorialOperation) {
        setQuickActionsOpen(false);
        setSelectedOperation(operation);
    }

    function send() {
        if (!selectedOperation || !guidance.trim())
            return;

        void onRequest(selectedOperation, guidance, selectedOperation === EDITORIAL_OPERATION.TRANSLATION ? language : undefined);
    }

    if (collapsed)
        return <aside className="flex h-full w-12 flex-col border-l border-border bg-surface-supporting p-1" aria-label={intl.formatMessage({ id: "assistant.panel" })}>
            <header className="flex min-h-18 w-full items-center justify-center">
                <Button className="inline-grid size-9 place-items-center !p-0" variant="quiet" aria-label={intl.formatMessage({ id: "assistant.expand" })} onClick={() => setCollapsed(false)}>
                    <span className="grid size-full place-items-center">
                        <AssistantMark />
                    </span>
                </Button>
            </header>
        </aside>;

    return <aside className="flex h-full min-h-0 w-96 flex-col border-l border-border bg-surface-supporting" aria-label={intl.formatMessage({ id: "assistant.panel" })}>
        <header className="flex min-h-18 items-center border-b border-border px-5">
            <AssistantMark />
            <h2 className="ml-3 text-base font-semibold">{intl.formatMessage({ id: "assistant.heading" })}</h2>
            <Button className="ml-auto inline-grid size-9 place-items-center p-1" variant="quiet" aria-label={intl.formatMessage({ id: "assistant.collapse" })} onClick={() => setCollapsed(true)}>
                <CollapseMark />
            </Button>
        </header>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-8">
            <p className="max-w-sm text-base leading-8 text-muted">{intl.formatMessage({ id: "assistant.intro" })}</p>
            {state === "streaming" && <Status label={intl.formatMessage({ id: "assistant.preparing" })} tone="info" />}
            {message && <Banner className="mt-5" tone="error" role="alert">{message}</Banner>}
        </div>
        <div className="shrink-0 border-t border-border px-5 py-7">
            <div className="relative mt-auto py-3">
                {quickActionsOpen && <div className="absolute bottom-full left-0 z-10 mb-2 w-52 rounded-panel border border-border bg-surface-raised p-1 shadow-raised">
                    {Object.values(EDITORIAL_OPERATION).map((operation) => <Button className="flex w-full justify-start text-xs" key={operation} disabled={state === "streaming"} variant="quiet" onClick={() => selectOperation(operation)}>{intl.formatMessage({ id: editorialOperationLabels[operation] })}</Button>)}
                </div>}
                <Button className="flex items-center gap-2" variant="secondary" aria-expanded={quickActionsOpen} aria-label={selectedOperation ? intl.formatMessage({ id: "assistant.quickActionSelected" }, { operation: intl.formatMessage({ id: editorialOperationLabels[selectedOperation] }) }) : intl.formatMessage({ id: "assistant.quickActions" })} onClick={() => setQuickActionsOpen((open) => !open)}>
                    {selectedOperation ? `${intl.formatMessage({ id: "assistant.quickActions" })}: ${intl.formatMessage({ id: editorialOperationLabels[selectedOperation] })}` : intl.formatMessage({ id: "assistant.quickActions" })}
                    <DisclosureMark open={quickActionsOpen} />
                </Button>
            </div>
            <div className="relative">
                <TextareaField className="min-h-25 resize-y pr-12" aria-label={intl.formatMessage({ id: "assistant.guidance" })} value={guidance} onChange={(event) => setGuidance(event.target.value)} placeholder={intl.formatMessage({ id: "assistant.guidancePlaceholder" })} />
                <Button className="absolute bottom-2 right-2 inline-grid size-9 place-items-center p-1" variant="quiet" aria-label={intl.formatMessage({ id: "assistant.send" })} disabled={state === "streaming" || !selectedOperation || !guidance.trim()} onClick={send}>
                    <SendMark />
                </Button>
            </div>
            {state === "streaming" && <Button className="mt-3" variant="danger" onClick={onCancel}>{intl.formatMessage({ id: "assistant.stop" })}</Button>}
        </div>
    </aside>;
}
