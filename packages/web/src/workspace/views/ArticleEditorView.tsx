import { ArticleRichEditor } from "../editor/ArticleRichEditor.js";


export function ArticleEditorView({ articleId, content, setContent }: {
    articleId: string;
    content: string;
    setContent: (value: string) => void;
}) {
    return <ArticleRichEditor articleId={articleId} content={content} setContent={setContent} />;
}
