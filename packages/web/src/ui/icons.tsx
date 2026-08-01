import type { ReactNode, SVGProps } from "react";
import type { Tone } from "./primitives.js";


export function Icon({ children, ...props }: SVGProps<SVGSVGElement> & { children?: ReactNode }) {
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{children}</svg>;
}


export function FormatIcon({ children, ...props }: SVGProps<SVGSVGElement> & { children?: ReactNode }) {
    return <Icon width="16" height="16" strokeWidth="2" {...props}>{children}</Icon>;
}


export const BoldIcon = () => <FormatIcon><path d="M7 5h6a3 3 0 0 1 0 6H7zM7 11h7a3 3 0 0 1 0 6H7z" /></FormatIcon>;
export const ItalicIcon = () => <FormatIcon><path d="M19 4h-9M14 20H5M15 4 9 20" /></FormatIcon>;
export const StrikeIcon = () => <FormatIcon><path d="M5 12h14M16 6.5c-.7-1-2-1.5-4-1.5-2.5 0-4 1.2-4 3 0 4 8 2 8 6 0 1.8-1.7 3-4 3-2 0-3.5-.7-4.5-2" /></FormatIcon>;
export const CodeIcon = () => <FormatIcon><path d="m8 9-3 3 3 3M16 9l3 3-3 3" /></FormatIcon>;
export const LinkIcon = () => <FormatIcon><path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1" /></FormatIcon>;
export const ListIcon = () => <FormatIcon><path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" /></FormatIcon>;
export const NumberedListIcon = () => <FormatIcon><path d="M10 6h10M10 12h10M10 18h10M4 5h1v3M4 15h2l-2 3h2" /></FormatIcon>;


export function ChevronDownIcon(props: SVGProps<SVGSVGElement>) {
    return <Icon strokeWidth="1.8" {...props}><path d="m6 9 6 6 6-6" /></Icon>;
}


export function ChevronRightIcon(props: SVGProps<SVGSVGElement>) {
    return <Icon strokeWidth="1.8" {...props}><path d="m9 18 6-6-6-6" /></Icon>;
}


export function CloseIcon(props: SVGProps<SVGSVGElement>) {
    return <Icon strokeWidth="2" {...props}><path d="m6 6 12 12M18 6 6 18" /></Icon>;
}


export function SuccessIcon(props: SVGProps<SVGSVGElement>) {
    return <Icon strokeWidth="2" {...props}><path d="m5 12 4 4L19 6" /></Icon>;
}


export function InfoIcon(props: SVGProps<SVGSVGElement>) {
    return <Icon strokeWidth="2" {...props}><circle cx="12" cy="12" r="9" /><path d="M12 10v6M12 7h.01" /></Icon>;
}


export function WarningIcon(props: SVGProps<SVGSVGElement>) {
    return <Icon strokeWidth="2" {...props}><path d="M12 3 2.8 20h18.4L12 3Z" /><path d="M12 9v5M12 17h.01" /></Icon>;
}


export function StatusIcon({ tone, ...props }: SVGProps<SVGSVGElement> & { tone: Tone }) {
    if (tone === "success")
        return <SuccessIcon {...props} />;

    if (tone === "info")
        return <InfoIcon {...props} />;

    return <WarningIcon {...props} />;
}


export function UserIcon(props: SVGProps<SVGSVGElement>) {
    return <Icon strokeWidth="1.8" {...props}><circle cx="12" cy="8" r="3" /><path d="M5.5 20c.6-3.3 3.1-5 6.5-5s5.9 1.7 6.5 5" /></Icon>;
}


export function SettingsIcon(props: SVGProps<SVGSVGElement>) {
    return <Icon strokeWidth="1.8" {...props}><circle cx="12" cy="12" r="3.25" /><path d="M12 2.75v2.5M12 18.75v2.5M21.25 12h-2.5M5.25 12h-2.5M18.54 5.46l-1.77 1.77M7.23 16.77l-1.77 1.77M18.54 18.54l-1.77-1.77M7.23 7.23 5.46 5.46" /></Icon>;
}


export function SearchIcon(props: SVGProps<SVGSVGElement>) {
    return <Icon strokeWidth="1.8" {...props}><circle cx="11" cy="11" r="5.5" /><path d="m15.25 15.25 4 4" /></Icon>;
}


export function ArticleIcon(props: SVGProps<SVGSVGElement>) {
    return <Icon strokeWidth="1.8" {...props}><path d="M6.5 3.5h7l4 4v13h-11z" /><path d="M13.5 3.5v4h4M8.5 12h7M8.5 15.5h7" /></Icon>;
}


export function AssistantIcon(props: SVGProps<SVGSVGElement>) {
    return <Icon strokeWidth="1.8" {...props}><path strokeLinecap="round" strokeLinejoin="round" d="m12 3 .9 3.1L16 7l-3.1.9L12 11l-.9-3.1L8 7l3.1-.9L12 3Zm6 8 .6 2.4L21 14l-2.4.6L18 17l-.6-2.4L15 14l2.4-.6L18 11ZM6 13l.9 3.1L10 17l-3.1.9L6 21l-.9-3.1L2 17l3.1-.9L6 13Z" /></Icon>;
}


export function SendIcon(props: SVGProps<SVGSVGElement>) {
    return <Icon strokeWidth="1.8" {...props}><path d="m21 3-7.5 18-3.75-7.5L3 9l18-6Z" /><path d="M9.75 13.5 14.5 9" /></Icon>;
}


export function SaveIcon(props: SVGProps<SVGSVGElement>) {
    return <Icon strokeWidth="1.8" {...props}><path d="M4.5 3.5h13l2 2v15h-15z" /><path d="M8 3.5v6h7v-6M8 20.5v-7h8v7" /></Icon>;
}


export function DeleteIcon(props: SVGProps<SVGSVGElement>) {
    return <Icon strokeWidth="1.8" {...props}><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5" /></Icon>;
}


export function FocusIcon(props: SVGProps<SVGSVGElement>) {
    return <Icon strokeWidth="1.8" {...props}><path d="M8 3H3v5M16 3h5v5M21 16v5h-5M3 16v5h5" /></Icon>;
}


export function LeaveFocusIcon(props: SVGProps<SVGSVGElement>) {
    return <Icon strokeWidth="1.8" {...props}><path d="M9 3v5H4M15 3v5h5M4 16h5v5M20 16h-5v5" /></Icon>;
}
