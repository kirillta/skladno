import { TextareaField } from "../../ui/primitives.js";


export function ArticleEditorView({ content, setContent }: {
    content: string;
    setContent: (value: string) => void;
}) {
    return <div className="h-full min-h-0 overflow-y-auto bg-surface-raised [scrollbar-color:var(--color-border-strong)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-button]:hidden [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border-strong [&::-webkit-scrollbar-track]:bg-transparent">
        <div className="min-h-full px-8 py-7">
            <div className="mx-auto w-full max-w-3xl">
                <TextareaField
                    aria-label="Article draft"
                    className="min-h-full resize-none border-0 bg-transparent px-0 font-editor text-xl leading-8 shadow-none focus-visible:outline-none [field-sizing:content]"
                    value={content}
                    onChange={(event) => setContent(event.target.value)}
                    placeholder="Write your article..."
                />
            </div>
        </div>
    </div>;
}
