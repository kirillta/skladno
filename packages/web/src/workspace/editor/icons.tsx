import type { SVGProps } from "react";

export function FormatIcon({ children, ...props }: SVGProps<SVGSVGElement>) {
    return <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{children}</svg>;
}

export const BoldIcon = () => <FormatIcon><path d="M7 5h6a3 3 0 0 1 0 6H7zM7 11h7a3 3 0 0 1 0 6H7z" /></FormatIcon>;
export const ItalicIcon = () => <FormatIcon><path d="M19 4h-9M14 20H5M15 4 9 20" /></FormatIcon>;
export const StrikeIcon = () => <FormatIcon><path d="M5 12h14M16 6.5c-.7-1-2-1.5-4-1.5-2.5 0-4 1.2-4 3 0 4 8 2 8 6 0 1.8-1.7 3-4 3-2 0-3.5-.7-4.5-2" /></FormatIcon>;
export const CodeIcon = () => <FormatIcon><path d="m8 9-3 3 3 3M16 9l3 3-3 3" /></FormatIcon>;
export const LinkIcon = () => <FormatIcon><path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1" /></FormatIcon>;
export const ListIcon = () => <FormatIcon><path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" /></FormatIcon>;
export const NumberedListIcon = () => <FormatIcon><path d="M10 6h10M10 12h10M10 18h10M4 5h1v3M4 15h2l-2 3h2" /></FormatIcon>;
