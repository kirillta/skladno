import { useState } from "react";
import { EDITORIAL_OPERATION, type EditorialOperation } from "@skladno/shared";
import { Button, Select, TextareaField } from "../../ui/primitives.js";


export function EditorialAssistantPanel({ state, message, onRequest, onCancel, collapsed, setCollapsed }: {
    state: "idle" | "streaming" | "error";
    message: string;
    onRequest: (operation: EditorialOperation, guidance: string, language?: string) => Promise<void>;
    onCancel: () => void;
    collapsed: boolean;
    setCollapsed: (value: boolean) => void
}) {
    const [guidance, setGuidance] = useState("");
    const [language, setLanguage] = useState("Spanish");

    if (collapsed)
        return <aside className="h-full w-12 border-l border-border p-1" aria-label="Editorial Assistant Panel">
            <Button variant="quiet" aria-label="Expand Editorial Assistant Panel" onClick={() => setCollapsed(false)}>✦</Button>
        </aside>;

    return <aside className="flex h-full min-h-0 w-96 flex-col border-l border-border bg-surface-raised" aria-label="Editorial Assistant Panel">
        <header className="flex min-h-16 items-center border-b border-border px-5">
            <span aria-hidden="true" className="mr-2 text-brand">✦</span>
            <h2 className="font-semibold">Editorial Assistant</h2>
            <Button className="ml-auto" variant="quiet" aria-label="Collapse Editorial Assistant Panel" onClick={() => setCollapsed(true)}>›</Button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <p className="max-w-sm text-sm leading-6 text-muted">Ask for a focused editorial operation when you are ready. Suggestions stay separate from your Article until you accept them.</p>
            {state === "streaming" && <p className="mt-4 text-sm text-brand" role="status">Preparing your proposal...</p>}
            {message && <p className="mt-4 text-sm text-danger">{message}</p>}
        </div>
        <div className="shrink-0 border-t border-border px-5 py-4">
            <p className="mb-2 text-xs text-muted">Network requests send only the current Article revision and guidance needed for this operation.</p>
            <TextareaField aria-label="Editorial guidance" value={guidance} onChange={(event) => setGuidance(event.target.value)} placeholder="Ask or instruct..." />
            <Select className="mt-2" aria-label="Target language" value={language} onChange={(event) => setLanguage(event.target.value)}>
                <option>Spanish</option>
                <option>English</option>
                <option>Portuguese</option>
            </Select>
            <div className="mt-3 grid grid-cols-2 gap-2">
                {Object.values(EDITORIAL_OPERATION).map((operation) => <Button key={operation} disabled={state === "streaming"} variant="secondary" onClick={() => void onRequest(operation, guidance, operation === EDITORIAL_OPERATION.TRANSLATION ? language : undefined)}>{operation.replaceAll("_", " ")}</Button>)}
            </div>
            {state === "streaming" && <Button className="mt-3" variant="danger" onClick={onCancel}>Stop request</Button>}
        </div>
    </aside>;
}
