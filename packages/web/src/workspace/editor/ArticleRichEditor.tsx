import { useMemo } from "react";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { ArticleEditorContents } from "./ArticleEditorContents.js";
import { articleEditorNodes, articleEditorTheme } from "./article-editor-config.js";


export { articleEditorNodes, articleEditorTheme } from "./article-editor-config.js";


export function ArticleRichEditor({ articleId, content, setContent, onSelectionChange, assistantSelection }: { articleId: string; content: string; setContent: (value: string) => void; onSelectionChange?: (value: string | undefined) => void; assistantSelection?: string }) {
    const config = useMemo(() => ({
        namespace: `skladno-article-${articleId}`,
        nodes: articleEditorNodes,
        theme: articleEditorTheme,
        onError: (error: Error) => {
            throw error;
        }
    }),
    [articleId]
    );

    return <LexicalComposer key={articleId} initialConfig={config}>
        <div className="flex h-full min-h-0 flex-col">
            <ArticleEditorContents content={content} onChange={setContent} onSelectionChange={onSelectionChange} assistantSelection={assistantSelection} />
        </div>
    </LexicalComposer>;
}
