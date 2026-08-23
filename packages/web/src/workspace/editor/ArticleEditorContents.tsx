import { useState } from "react";
import { useIntl } from "react-intl";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import type { LexicalEditor } from "lexical";
import { LinkControl } from "./ArticleEditorToolbar.js";
import { AssistantSelectionHighlight, EditorBridge, EditorSelectionBridge, SupportedPastePlugin } from "./ArticleEditorPlugins.js";


export function ArticleEditorContents({ content, onChange, onSelectionChange, assistantSelection }: { content: string; onChange: (value: string) => void; onSelectionChange?: (value: string | undefined) => void; assistantSelection?: string }) {
    const intl = useIntl();
    const [editor, setEditor] = useState<LexicalEditor>();
    return <>{editor && <LinkControl editor={editor} />}
        <div className="min-h-0 flex-1 overflow-y-auto bg-surface-raised [scrollbar-color:var(--color-border-strong)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-button]:hidden [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border-strong">
            <div className="min-h-full px-8 py-7">
                <div className="relative mx-auto w-full max-w-3xl">
                    <RichTextPlugin contentEditable={<ContentEditable aria-label={intl.formatMessage({ id: "editor.articleDraft" })} className="min-h-[calc(100vh-16rem)] whitespace-pre-wrap font-editor text-xl leading-8 text-ink outline-none [&_a]:text-brand [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-border-strong [&_pre]:overflow-x-auto [&_pre]:rounded-control [&_pre]:bg-surface [&_pre]:p-4 [&_pre]:font-mono [&_h1]:text-4xl [&_h2]:text-3xl [&_h3]:text-2xl [&_h4]:text-xl [&_h4]:font-bold [&_h4]:leading-7 [&_h5]:text-lg [&_h5]:font-bold [&_h5]:leading-7 [&_h6]:text-base [&_h6]:font-bold [&_h6]:uppercase [&_h6]:tracking-wide [&_h6]:leading-6" />} placeholder={<p className="pointer-events-none absolute top-0 text-xl text-muted">{intl.formatMessage({ id: "editor.placeholder" })}</p>} ErrorBoundary={LexicalErrorBoundary} />
                    <HistoryPlugin />
                    <ListPlugin />
                    <LinkPlugin />
                    <SupportedPastePlugin />
                    <EditorBridge content={content} onChange={onChange} onReady={setEditor} />
                    <EditorSelectionBridge onSelectionChange={onSelectionChange} />
                    <AssistantSelectionHighlight active={Boolean(assistantSelection)} />
                </div>
            </div>
        </div>
    </>;
}
