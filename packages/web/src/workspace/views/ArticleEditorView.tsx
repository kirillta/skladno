import { TextareaField } from "../../ui/primitives.js";


export function ArticleEditorView({ content, setContent }: {
    content: string;
    setContent: (value: string) => void;
}) {
    return <div className="flex h-full min-h-0 flex-col bg-surface-raised">
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
