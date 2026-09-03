import { ArticleRichEditor } from "../editor/ArticleRichEditor.js";
import type { AssistantSelectionSnapshot } from "../editor/ArticleEditorPlugins.js";


export function ArticleEditorView({ articleId, content, setContent, onSelectionChange, assistantSelection }: {
    articleId: string;
    content: string;
    setContent: (value: string) => void;
    onSelectionChange?: (value: AssistantSelectionSnapshot | undefined) => void;
    assistantSelection?: string;
}) {
    return <ArticleRichEditor articleId={articleId} content={content} setContent={setContent} onSelectionChange={onSelectionChange} assistantSelection={assistantSelection} />;
}
