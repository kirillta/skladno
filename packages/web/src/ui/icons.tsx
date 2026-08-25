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
export const SideBySideIcon = () => <FormatIcon><path d="M4 7h6M4 11h6M4 15h6M14 7h6M14 11h4" /></FormatIcon>;
export const AlignedParagraphsIcon = () => <FormatIcon><path d="M3.5 6h7M13.5 6h7M3.5 10h5M15.5 10h5M3.5 14h7M13.5 14h7M3.5 18h5M15.5 18h5" /></FormatIcon>;


export function ChevronDownIcon(props: SVGProps<SVGSVGElement>) {
    return <Icon strokeWidth="1.8" {...props}><path d="m6 9 6 6 6-6" /></Icon>;
}


export function ChevronRightIcon(props: SVGProps<SVGSVGElement>) {
    return <Icon strokeWidth="1.8" {...props}><path d="m9 18 6-6-6-6" /></Icon>;
}


export function ArrowLeftIcon(props: SVGProps<SVGSVGElement>) {
    return <Icon strokeWidth="1.8" {...props}><path d="M19 12H5M12 19l-7-7 7-7" /></Icon>;
}


export function CopyIcon(props: SVGProps<SVGSVGElement>) {
    return <Icon strokeWidth="1.8" {...props}><rect x="9" y="8" width="10" height="11" rx="1" /><path d="M15 8V5a1 1 0 0 0-1-1H6a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" /></Icon>;
}


export function CloseIcon(props: SVGProps<SVGSVGElement>) {
    return <Icon strokeWidth="2" {...props}><path d="m6 6 12 12M18 6 6 18" /></Icon>;
}


export function StopIcon(props: SVGProps<SVGSVGElement>) {
    return <Icon strokeWidth="1.8" {...props}><rect x="7" y="7" width="10" height="10" rx="1" /></Icon>;
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


export function StarIcon(props: SVGProps<SVGSVGElement>) {
    return <Icon strokeWidth="1.8" {...props}><path d="m12 3.5 2.6 5.25 5.8.85-4.2 4.1.99 5.8L12 16.77 6.81 19.5l.99-5.8-4.2-4.1 5.8-.85z" /></Icon>;
}


export function ArticleIcon(props: SVGProps<SVGSVGElement>) {
    return <Icon strokeWidth="1.8" {...props}><path d="M6.5 3.5h7l4 4v13h-11z" /><path d="M13.5 3.5v4h4M8.5 12h7M8.5 15.5h7" /></Icon>;
}


export function AssistantIcon(props: SVGProps<SVGSVGElement>) {
    return <Icon strokeWidth="1.8" {...props}><path strokeLinecap="round" strokeLinejoin="round" d="m12 3 .9 3.1L16 7l-3.1.9L12 11l-.9-3.1L8 7l3.1-.9L12 3Zm6 8 .6 2.4L21 14l-2.4.6L18 17l-.6-2.4L15 14l2.4-.6L18 11ZM6 13l.9 3.1L10 17l-3.1.9L6 21l-.9-3.1L2 17l3.1-.9L6 13Z" /></Icon>;
}


export function OpenAiIcon(props: SVGProps<SVGSVGElement>) {
    return <svg viewBox="0 0 721 721" fill="currentColor" aria-hidden="true" {...props}><path d="M304.246 294.611V249.028c0-3.839 1.441-6.719 4.798-8.636l91.648-52.78c12.475-7.197 27.35-10.554 42.702-10.554 57.577 0 94.046 44.624 94.046 92.124 0 3.358 0 7.197-.481 11.036l-95.005-55.66c-5.757-3.357-11.517-3.357-17.274 0l-120.434 70.053ZM518.245 472.145V363.224c0-6.719-2.881-11.517-8.637-14.875l-120.434-70.053 39.345-22.553c3.358-1.917 6.238-1.917 9.596 0l91.647 52.78c26.392 15.356 44.143 47.982 44.143 79.648 0 36.465-21.59 70.054-55.66 83.97ZM275.937 376.182l-39.345-23.03c-3.357-1.917-4.798-4.798-4.798-8.637V238.956c0-51.339 39.345-90.207 92.606-90.207 20.155 0 38.864 6.719 54.702 18.714l-94.524 54.701c-5.756 3.357-8.636 8.155-8.636 14.875v139.143l-.005.004Zm84.689 48.94-56.38-31.667v-67.172l56.38-31.667 56.376 31.667v67.172l-56.376 31.667Zm36.226 145.867c-20.154 0-38.863-6.719-54.701-18.713l94.523-54.702c5.757-3.357 8.637-8.155 8.637-14.875V343.552l39.827 23.03c3.357 1.917 4.798 4.797 4.798 8.637v105.559c0 51.339-39.827 90.207-93.084 90.207ZM283.134 463.99l-91.648-52.779c-26.392-15.357-44.143-47.982-44.143-79.649 0-36.946 22.072-70.053 56.137-83.969v109.398c0 6.719 2.881 11.517 8.637 14.875l119.957 69.571-39.345 22.553c-3.357 1.917-6.238 1.917-9.595 0Zm-5.275 78.69c-54.22 0-94.046-40.785-94.046-91.166 0-3.839.481-7.678.958-11.517l94.524 54.701c5.756 3.358 11.517 3.358 17.273 0l120.434-69.571v45.583c0 3.839-1.44 6.719-4.798 8.636l-91.647 52.78c-12.476 7.197-27.351 10.554-42.703 10.554Zm118.993 57.096c58.059 0 106.518-41.263 117.558-95.964 53.739-13.916 88.286-64.297 88.286-115.636 0-33.589-14.393-66.214-40.304-89.726 2.399-10.077 3.839-20.154 3.839-30.226 0-68.613-55.66-119.957-119.957-119.957-12.952 0-25.428 1.917-37.904 6.238-21.595-21.113-51.344-34.547-83.97-34.547-58.058 0-106.517 41.262-117.557 95.963-53.739 13.916-88.286 64.297-88.286 115.636 0 33.589 14.393 66.214 40.304 89.726-2.399 10.077-3.839 20.154-3.839 30.227 0 68.613 55.66 119.956 119.956 119.956 12.953 0 25.429-1.917 37.905-6.238 21.59 21.113 51.339 34.548 83.969 34.548Z" /></svg>;
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


export function RevisionManualIcon(props: SVGProps<SVGSVGElement>) {
    return <Icon strokeWidth="1.8" {...props}><path d="m5 19 3.2-.8L18.5 7.9a2.1 2.1 0 0 0-3-3L5.2 15.2zM13.8 6.6l3 3" /></Icon>;
}


export function RevisionAiIcon(props: SVGProps<SVGSVGElement>) {
    return <Icon strokeWidth="1.8" {...props}><path d="m12 3 .9 3.1L16 7l-3.1.9L12 11l-.9-3.1L8 7l3.1-.9L12 3Zm6 8 .6 2.4L21 14l-2.4.6L18 17l-.6-2.4L15 14l2.4-.6L18 11ZM6 13l.9 3.1L10 17l-3.1.9L6 21l-.9-3.1L2 17l3.1-.9L6 13Z" /></Icon>;
}


export function RevisionRestoreIcon(props: SVGProps<SVGSVGElement>) {
    return <Icon strokeWidth="1.8" {...props}><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></Icon>;
}
