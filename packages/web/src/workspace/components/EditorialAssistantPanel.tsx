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

    return <aside className={collapsed ? "w-12 border-l border-border p-1" : "w-80 border-l border-border p-3"} aria-label="Editorial Assistant Panel">
        <Button variant="quiet" aria-label="Toggle Editorial Assistant Panel" onClick={() => setCollapsed(!collapsed)}>✦</Button>
        {!collapsed && <><h2 className="mt-3 font-semibold">Editorial Assistant</h2>
            <p className="text-xs text-muted">Network requests send only the current Article revision and guidance needed for this operation.</p>
            <TextareaField className="mt-3" aria-label="Editorial guidance" value={guidance} onChange={(event) => setGuidance(event.target.value)} placeholder="Editorial guidance" />
            <Select className="mt-2" aria-label="Target language" value={language} onChange={(event) => setLanguage(event.target.value)}>
                <option>Spanish</option>
                <option>English</option>
                <option>Portuguese</option>
            </Select>
            <div className="mt-3 grid grid-cols-2 gap-2">{Object.values(EDITORIAL_OPERATION).map((operation) => <Button key={operation} disabled={state === "streaming"} variant="secondary" onClick={() => void onRequest(operation, guidance, operation === EDITORIAL_OPERATION.TRANSLATION ? language : undefined)}>{operation.replaceAll("_", " ")}</Button>)}</div>
            {state === "streaming" && <Button className="mt-3" variant="danger" onClick={onCancel}>Stop request</Button>}
            {message && <p className="mt-3 text-sm text-danger">{message}</p>}
        </>}
    </aside>;
}
