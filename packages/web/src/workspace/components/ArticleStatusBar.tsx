export function ArticleStatusBar({ saveState }: {
    saveState: "saved" | "saving" | "error"
}) {
    return <footer className="border-t border-border px-5 py-2 text-xs text-muted" aria-label="Article status">
        {saveState === "saved" ? "All changes saved as an immutable Revision." : saveState === "saving" ? "Saving Revision…" : "Revision save failed. Retry to keep your work."}
    </footer>;
}
