import { ArticleRichEditor } from "../editor/ArticleRichEditor.js";


export function ArticleEditorView({ articleId, content, setContent, onSelectionChange, assistantSelection }: {
    articleId: string;
    content: string;
    setContent: (value: string) => void;
    onSelectionChange?: (value: string | undefined) => void;
    assistantSelection?: string;
}) {
    return <ArticleRichEditor articleId={articleId} content={content} setContent={setContent} onSelectionChange={onSelectionChange} assistantSelection={assistantSelection} />;
}
