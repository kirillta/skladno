export function ArticleStatusBar({ saveState, characterCount }: {
    saveState: "saved" | "saving" | "error";
    characterCount: number
}) {
    const statusLabel = saveState === "saved" 
        ? "Saved" 
        : saveState === "saving" 
            ? "Saving revision" 
            : "Revision save failed";
    
    const statusTone = saveState === "saved" 
        ? "text-success" 
        : saveState === "saving" 
            ? "text-warning" 
            : "text-danger";

    return <footer className="flex h-6 shrink-0 items-center justify-between border-t border-border px-5 text-xs text-muted" aria-label="Article status">
        <span className={statusTone} role="status"><span aria-hidden="true">●</span> {statusLabel}</span>
        <span>{characterCount.toLocaleString()} characters</span>
    </footer>;
}
