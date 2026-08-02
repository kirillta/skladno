import { useCallback, useEffect, useState } from "react";
import { IntlProvider, useIntl } from "react-intl";
import { messages } from "../../i18n/messages.js";
import { EDITORIAL_OPERATION, KEY_BINDING_COMMAND, workflowStages, type Article, type EditorialOperation, type KeyBindingOverrides, type UpdateArticleInput, type WorkflowStage } from "@skladno/shared";
import { Banner, Button, Status, TextareaField } from "../../ui/primitives.js";
import { AssistantIcon, ChevronDownIcon, ChevronRightIcon, SendIcon } from "../../ui/icons.js";
import type { KeyBindingDispatcher } from "../../key-bindings/dispatcher.js";
import { shortcutHint } from "../../key-bindings/shortcut-hint.js";


const workflowStageLabels: Record<WorkflowStage, "articleHeader.talkingPoints" | "articleHeader.narrative" | "articleHeader.authorEdit" | "articleHeader.flow" | "articleHeader.facts" | "articleHeader.style" | "articleHeader.translate" | "articleHeader.publish"> = {
    talking_points: "articleHeader.talkingPoints",
    narrative_draft: "articleHeader.narrative",
    author_editing: "articleHeader.authorEdit",
    flow_and_clarity: "articleHeader.flow",
    fact_checking: "articleHeader.facts",
    style_review: "articleHeader.style",
    translation: "articleHeader.translate",
    publication_preview: "articleHeader.publish",
};

const stageOperations: Partial<Record<WorkflowStage, EditorialOperation>> = {
    talking_points: EDITORIAL_OPERATION.THESIS_TO_NARRATIVE,
    narrative_draft: EDITORIAL_OPERATION.FLOW_REVISION,
    flow_and_clarity: EDITORIAL_OPERATION.FLOW_REVISION,
    fact_checking: EDITORIAL_OPERATION.FACT_CHECK,
    style_review: EDITORIAL_OPERATION.STYLE_REVIEW,
    translation: EDITORIAL_OPERATION.TRANSLATION,
};


export function EditorialAssistantPanel(props: {
    state: "idle" | "streaming" | "error";
    message: string;
    onRequest: (operation: EditorialOperation, guidance: string, language?: string) => Promise<void>;
    onCancel: () => void;
    collapsed: boolean;
    setCollapsed: (value: boolean) => void;
    language: string;
    article?: Article;
    updateArticle?: (articleId: string, input: UpdateArticleInput) => Promise<unknown>;
    dispatcher?: KeyBindingDispatcher;
    shortcutOverrides?: KeyBindingOverrides;
}) {
    return <IntlProvider locale="en" messages={messages}>
        <LocalizedEditorialAssistantPanel {...props} />
    </IntlProvider>;
}

function LocalizedEditorialAssistantPanel({ state, message, onRequest, onCancel, collapsed, setCollapsed, language, article, updateArticle, dispatcher, shortcutOverrides }: {
    state: "idle" | "streaming" | "error";
    message: string;
    onRequest: (operation: EditorialOperation, guidance: string, language?: string) => Promise<void>;
    onCancel: () => void;
    collapsed: boolean;
    setCollapsed: (value: boolean) => void;
    language: string;
    article?: Article;
    updateArticle?: (articleId: string, input: UpdateArticleInput) => Promise<unknown>;
    dispatcher?: KeyBindingDispatcher;
    shortcutOverrides?: KeyBindingOverrides;
}) {
    const intl = useIntl();
    const [guidance, setGuidance] = useState("");
    const [stagesOpen, setStagesOpen] = useState(false);
    const [selectedOperation, setSelectedOperation] = useState<EditorialOperation>();

    function selectStage(stage: WorkflowStage) {
        setStagesOpen(false);
        setSelectedOperation(stageOperations[stage]);

        if (article && updateArticle)
            void updateArticle(article.id, { workflowStage: stage });
    }

    const send = useCallback(() => {
        if (!selectedOperation || !guidance.trim())
            return;

        void onRequest(selectedOperation, guidance, selectedOperation === EDITORIAL_OPERATION.TRANSLATION ? language : undefined);
    }, [guidance, language, onRequest, selectedOperation]);

    useEffect(() => {
        const unregisterSend = dispatcher?.register(KEY_BINDING_COMMAND.SEND_EDITORIAL_REQUEST, send);
        const unregisterStop = dispatcher?.register(KEY_BINDING_COMMAND.STOP_EDITORIAL_REQUEST, onCancel);
        return () => {
            unregisterSend?.();
            unregisterStop?.();
        };
    }, [dispatcher, onCancel, send, selectedOperation, guidance]);

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
            <Button className="ml-auto inline-grid size-9 place-items-center p-1" variant="quiet" title={shortcutHint(intl.formatMessage({ id: "assistant.collapse" }), KEY_BINDING_COMMAND.TOGGLE_EDITORIAL_ASSISTANT, shortcutOverrides)} aria-label={intl.formatMessage({ id: "assistant.collapse" })} onClick={() => setCollapsed(true)}>
                <ChevronRightIcon className="size-3" />
            </Button>
        </header>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-8">
            <p className="max-w-sm text-base leading-8 text-muted">{intl.formatMessage({ id: "assistant.intro" })}</p>
            {state === "streaming" && <Status label={intl.formatMessage({ id: "assistant.preparing" })} tone="info" />}
            {message && <Banner className="mt-5" tone="error" role="alert">{message}</Banner>}
        </div>
        <div className="shrink-0 border-t border-border px-5 py-7">
            <div className="relative mb-3 mt-auto">
                {stagesOpen && <div className="absolute bottom-full left-0 z-10 w-52 rounded-panel border border-border bg-surface-raised p-1 shadow-raised">
                    {workflowStages.map((stage) => <Button className="flex w-full justify-start text-xs" key={stage} disabled={state === "streaming"} variant="quiet" onClick={() => selectStage(stage)}>{intl.formatMessage({ id: workflowStageLabels[stage] })}</Button>)}
                </div>}
                <Button className="flex items-center gap-2" variant="secondary" aria-expanded={stagesOpen} aria-label={intl.formatMessage({ id: "assistant.stages" })} onClick={() => setStagesOpen((open) => !open)}>
                    {article ? `${intl.formatMessage({ id: "assistant.stages" })}: ${intl.formatMessage({ id: workflowStageLabels[article.workflowStage] })}` : intl.formatMessage({ id: "assistant.stages" })}
                    <ChevronDownIcon className={`size-4 transition-transform motion-reduce:transition-none ${stagesOpen ? "rotate-180" : ""}`} />
                </Button>
            </div>
            <div className="relative">
                <TextareaField className="min-h-25 resize-y pr-12" aria-label={intl.formatMessage({ id: "assistant.guidance" })} value={guidance} onChange={(event) => setGuidance(event.target.value)} placeholder={intl.formatMessage({ id: "assistant.guidancePlaceholder" })} />
                <Button className="absolute bottom-2 right-2 inline-grid size-9 place-items-center p-1" variant="quiet" title={shortcutHint(intl.formatMessage({ id: "assistant.send" }), KEY_BINDING_COMMAND.SEND_EDITORIAL_REQUEST, shortcutOverrides)} aria-label={intl.formatMessage({ id: "assistant.send" })} disabled={state === "streaming" || !selectedOperation || !guidance.trim()} onClick={send}>
                    <SendIcon className="size-4" />
                </Button>
            </div>
            {state === "streaming" && <Button className="mt-3" variant="danger" title={shortcutHint(intl.formatMessage({ id: "assistant.stop" }), KEY_BINDING_COMMAND.STOP_EDITORIAL_REQUEST, shortcutOverrides)} onClick={onCancel}>{intl.formatMessage({ id: "assistant.stop" })}</Button>}
        </div>
    </aside>;
}
