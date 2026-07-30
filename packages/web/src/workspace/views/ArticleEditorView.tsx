import { Button, TextareaField } from "../../ui/primitives.js";


export function ArticleEditorView({ content, setContent, copy, count }: {
    content: string;
    setContent: (value: string) => void;
    copy: () => Promise<void>;
    count: number
}) {
    return <div className="flex h-full min-h-0 flex-col bg-surface-raised">
        <div className="flex min-h-13 shrink-0 items-center border-b border-border px-5">
            <p className="text-xs text-muted">Writing surface</p>
            <span className="ml-auto mr-4 text-xs text-muted">{count.toLocaleString()} characters</span>
            <Button variant="quiet" onClick={() => void copy()}>Copy publishing text</Button>
        </div>
        <div className="min-h-0 flex-1 px-8 py-7">
            <div className="mx-auto h-full w-full max-w-3xl">
                <TextareaField
                    aria-label="Article draft"
                    className="h-full min-h-0 resize-none border-0 bg-transparent px-0 font-editor text-xl leading-8 shadow-none"
                    value={content}
                    onChange={(event) => setContent(event.target.value)}
                    placeholder="Write your article..."
                />
            </div>
        </div>
    </div>;
}
