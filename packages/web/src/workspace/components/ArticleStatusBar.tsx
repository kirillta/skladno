export function ArticleStatusBar({ revisionId, characterCount }: {
    revisionId: string;
    characterCount: number;
}) {
    return <footer className="flex h-6 shrink-0 items-center justify-between border-t border-border px-5 text-xs text-muted" aria-label="Article status">
        <span>Revision {revisionId.slice(0, 8)}</span>
        <span>{characterCount.toLocaleString()} characters</span>
    </footer>;
}
