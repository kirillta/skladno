import { useEffect } from "react";
import { $isLinkNode } from "@lexical/link";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $createTextNode, $getRoot, $isElementNode, type LexicalNode } from "lexical";
import { articleEditorNodes } from "../../editor/article-editor-config.js";
import { importArticleMarkdown } from "../../editor/markdown.js";


function isSafeLink(value: string): boolean {
    try {
        const protocol = new URL(value, "https://skladno.local").protocol;
        return protocol === "https:" || protocol === "http:" || protocol === "mailto:";
    } catch {
        return false;
    }
}


function descendants(node: LexicalNode): LexicalNode[] {
    if (!$isElementNode(node))
        return [];

    const children: LexicalNode[] = node.getChildren();
    return children.flatMap((child) => [child, ...descendants(child)]);
}


function MarkdownContent({ content }: { content: string }) {
    const [editor] = useLexicalComposerContext();

    useEffect(() => {
        editor.update(() => {
            importArticleMarkdown(content);
            for (const node of descendants($getRoot())) {
                if ($isLinkNode(node) && !isSafeLink(node.getURL()))
                    node.replace($createTextNode(node.getTextContent()));
            }
        }, { tag: "assistant-markdown" });
    }, [content, editor]);

    return null;
}


export function AssistantMarkdown({ content }: { content: string }) {
    return <LexicalComposer initialConfig={{ namespace: "skladno-assistant-markdown", editable: false, nodes: articleEditorNodes, onError: () => undefined }}>
        <RichTextPlugin contentEditable={<ContentEditable className="mt-1 whitespace-pre-wrap text-sm leading-6 text-ink [&_a]:text-brand [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-border-strong [&_blockquote]:pl-3 [&_pre]:overflow-x-auto [&_pre]:rounded-control [&_pre]:bg-surface [&_pre]:p-2 [&_pre]:font-mono" />} placeholder={null} ErrorBoundary={LexicalErrorBoundary} />
        <MarkdownContent content={content} />
    </LexicalComposer>;
}
