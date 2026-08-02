import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { useIntl } from "react-intl";
import { importArticleMarkdown } from "./markdown.js";
import { articleEditorNodes, articleEditorTheme } from "./ArticleRichEditor.js";


export function RevisionArticlePreview({ revisionId, content }: { revisionId: string; content: string }) {
    const intl = useIntl();
    const config = {
        namespace: `skladno-revision-${revisionId}`,
        editable: false,
        editorState: () => importArticleMarkdown(content),
        nodes: articleEditorNodes,
        theme: articleEditorTheme,
        onError(error: Error) {
            throw error;
        },
    };

    if (!content)
        return <p className="text-muted">{intl.formatMessage({ id: "revisions.emptyContent" })}</p>;

    return <LexicalComposer key={revisionId} initialConfig={config}>
        <RichTextPlugin
            contentEditable={<ContentEditable aria-label={intl.formatMessage({ id: "revisions.articleContent" })} className="whitespace-pre-wrap font-editor text-xl leading-8 text-ink outline-none [&_a]:text-brand [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-border-strong [&_blockquote]:pl-4 [&_pre]:overflow-x-auto [&_pre]:rounded-control [&_pre]:bg-surface [&_pre]:p-4 [&_pre]:font-mono [&_h1]:text-4xl [&_h2]:text-3xl [&_h3]:text-2xl [&_h4]:text-xl [&_h4]:font-bold [&_h4]:leading-7 [&_h5]:text-lg [&_h5]:font-bold [&_h5]:leading-7 [&_h6]:text-base [&_h6]:font-bold [&_h6]:uppercase [&_h6]:tracking-wide [&_h6]:leading-6" />}
            placeholder={null}
            ErrorBoundary={({ children }) => <>{children}</>}
        />
    </LexicalComposer>;
}
