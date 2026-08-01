import { useState } from "react";
import { IntlProvider, useIntl } from "react-intl";
import { messages } from "../../i18n/messages.js";
import { EDITORIAL_OPERATION, type EditorialOperation } from "@skladno/shared";
import { Banner, Button, Status, TextareaField } from "../../ui/primitives.js";
import { AssistantIcon, ChevronDownIcon, ChevronRightIcon, SendIcon } from "../../ui/icons.js";


const editorialOperationLabels: Record<EditorialOperation, "operations.thesisToNarrative" | "operations.flowRevision" | "operations.factCheck" | "operations.styleReview" | "operations.translation"> = {
    [EDITORIAL_OPERATION.THESIS_TO_NARRATIVE]: "operations.thesisToNarrative",
    [EDITORIAL_OPERATION.FLOW_REVISION]: "operations.flowRevision",
    [EDITORIAL_OPERATION.FACT_CHECK]: "operations.factCheck",
    [EDITORIAL_OPERATION.STYLE_REVIEW]: "operations.styleReview",
    [EDITORIAL_OPERATION.TRANSLATION]: "operations.translation",
};


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
        return <aside className="flex h-full w-full flex-col border-l border-border bg-surface-supporting p-1" aria-label={intl.formatMessage({ id: "assistant.panel" })}>
            <header className="flex min-h-18 w-full items-center justify-center">
                <Button className="inline-grid size-9 place-items-center !p-0" variant="quiet" aria-label={intl.formatMessage({ id: "assistant.expand" })} onClick={() => setCollapsed(false)}>
                    <span className="grid size-full place-items-center">
                        <AssistantIcon className="size-5 shrink-0 text-brand" />
                    </span>
                </Button>
            </header>
        </aside>;

    return <aside className="flex h-full min-h-0 w-full flex-col border-l border-border bg-surface-supporting" aria-label={intl.formatMessage({ id: "assistant.panel" })}>
        <header className="flex min-h-18 items-center border-b border-border px-5">
            <AssistantIcon className="size-5 shrink-0 text-brand" />
            <h2 className="ml-3 text-base font-semibold">{intl.formatMessage({ id: "assistant.heading" })}</h2>
            <Button className="ml-auto inline-grid size-9 place-items-center p-1" variant="quiet" aria-label={intl.formatMessage({ id: "assistant.collapse" })} onClick={() => setCollapsed(true)}>
                <ChevronRightIcon className="size-3" />
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
                    <ChevronDownIcon className={`size-4 transition-transform motion-reduce:transition-none ${quickActionsOpen ? "rotate-180" : ""}`} />
                </Button>
            </div>
            <div className="relative">
                <TextareaField className="min-h-25 resize-y pr-12" aria-label={intl.formatMessage({ id: "assistant.guidance" })} value={guidance} onChange={(event) => setGuidance(event.target.value)} placeholder={intl.formatMessage({ id: "assistant.guidancePlaceholder" })} />
                <Button className="absolute bottom-2 right-2 inline-grid size-9 place-items-center p-1" variant="quiet" aria-label={intl.formatMessage({ id: "assistant.send" })} disabled={state === "streaming" || !selectedOperation || !guidance.trim()} onClick={send}>
                    <SendIcon className="size-4" />
                </Button>
            </div>
            {state === "streaming" && <Button className="mt-3" variant="danger" onClick={onCancel}>{intl.formatMessage({ id: "assistant.stop" })}</Button>}
        </div>
    </aside>;
}
