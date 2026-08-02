import { ArticleRichEditor } from "../editor/ArticleRichEditor.js";


export function ArticleEditorView({ articleId, content, setContent, onSelectionChange }: {
    articleId: string;
    content: string;
    setContent: (value: string) => void;
    onSelectionChange?: (value: string | undefined) => void;
}) {
    return <ArticleRichEditor articleId={articleId} content={content} setContent={setContent} onSelectionChange={onSelectionChange} />;
}
