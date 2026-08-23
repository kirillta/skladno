import { CodeNode } from "@lexical/code";
import { LinkNode } from "@lexical/link";
import { ListItemNode, ListNode } from "@lexical/list";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import type { EditorThemeClasses } from "lexical";


export const articleEditorTheme: EditorThemeClasses = {
    text: {
        bold: "font-bold",
        code: "rounded-control bg-surface px-1 font-mono text-base",
        italic: "italic",
        strikethrough: "line-through",
    },
    list: {
        listitem: "my-1",
        ol: "list-decimal pl-7",
        ul: "list-disc pl-7",
    },
};


export const articleEditorNodes = [HeadingNode, QuoteNode, ListNode, ListItemNode, LinkNode, CodeNode];
