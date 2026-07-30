import { Button, TextareaField } from "../../ui/primitives.js";

export function ArticleEditorView({ content, setContent, copy, count }: { 
    content: string; 
    setContent: (value: string) => void; 
    copy: () => Promise<void>; 
    count: number 
}) {
    return <div>
        <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Writing surface</h2>
            <span className="text-xs text-muted">{count} publishing characters</span>
            <Button variant="secondary" onClick={() => void copy()}>Copy publishing text</Button>
        </div>
        <TextareaField aria-label="Article draft" className="min-h-[62vh] font-editor leading-8" value={content} onChange={(event) => setContent(event.target.value)} placeholder="Write your article…" />
    </div>;
}
