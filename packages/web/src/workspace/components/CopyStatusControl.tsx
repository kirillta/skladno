import { useEffect, useId, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { ChevronDownIcon, CopyIcon, SuccessIcon } from "../../ui/icons.js";
import { handleStatusMenuKeyDown, openStatusMenu } from "./ArticleStatusBarMenu.js";


export function CopyStatusControl({ copyMarkdown, copyPlainText, open, onToggle, onOpen, onClose }: { copyMarkdown: () => Promise<boolean>; copyPlainText: () => Promise<boolean>; open: boolean; onToggle: () => void; onOpen: () => void; onClose: () => void }) {
    const intl = useIntl();
    const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
    const copyTimer = useRef<ReturnType<typeof setTimeout>>();
    const trigger = useRef<HTMLButtonElement>(null);
    const menuId = useId();

    useEffect(() => () => clearTimeout(copyTimer.current), []);


    function copy(copyText: () => Promise<boolean>) {
        void copyText().then((copied) => {
            setCopyStatus(copied ? "copied" : "failed");
            onClose();
            trigger.current?.focus();
            clearTimeout(copyTimer.current);
            copyTimer.current = setTimeout(() => setCopyStatus("idle"), 1200);
        });
    }


    return <div className="relative ml-2 flex items-center border-l border-border pl-2">
        <button className={`inline-flex h-6 items-center gap-1 px-1.5 transition-colors hover:bg-brand-soft hover:text-brand ${copyStatus === "failed" ? "text-danger" : "text-muted"}`} type="button" aria-live="polite" onClick={() => copy(copyMarkdown)}>
            {copyStatus === "copied" ? <SuccessIcon className="size-3 motion-safe:animate-pulse" /> : <CopyIcon className="size-3" />}
            <span>{intl.formatMessage({ id: copyStatus === "copied" ? "articleHeader.copied" : copyStatus === "failed" ? "articleHeader.copyFailed" : "articleHeader.copy" })}</span>
        </button>
        <button ref={trigger} className="grid size-6 place-items-center text-muted transition-colors hover:bg-brand-soft hover:text-brand" type="button" aria-label={intl.formatMessage({ id: "articleHeader.copyOptions" })} aria-controls={open ? menuId : undefined} aria-expanded={open} aria-haspopup="menu" onClick={onToggle} onKeyDown={(event) => {
            if (event.key === "Escape")
                onClose();

            openStatusMenu(event, onOpen, menuId);
        }}>
            <ChevronDownIcon className={`size-3 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {open && <div id={menuId} className="absolute bottom-6 right-0 z-10 w-40 rounded-control border border-border bg-surface-raised p-1 shadow-raised" role="menu" aria-label={intl.formatMessage({ id: "articleHeader.copyOptions" })} onKeyDown={(event) => handleStatusMenuKeyDown(event, () => {
            onClose();
            trigger.current?.focus();
        })}>
            <button className="flex min-h-9 w-full items-center rounded-control px-2 text-left text-xs text-ink hover:bg-brand-soft focus:outline-none" type="button" role="menuitem" onClick={() => copy(copyMarkdown)}>{intl.formatMessage({ id: "articleHeader.copyMarkdown" })}</button>
            <button className="flex min-h-9 w-full items-center rounded-control px-2 text-left text-xs text-ink hover:bg-brand-soft focus:outline-none" type="button" role="menuitem" onClick={() => copy(copyPlainText)}>{intl.formatMessage({ id: "articleHeader.copyPlainText" })}</button>
        </div>}
    </div>;
}
