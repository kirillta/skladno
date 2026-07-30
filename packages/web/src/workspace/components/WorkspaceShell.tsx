import type { ReactNode } from "react";

export function WorkspaceShell({ children, library, assistant, focusMode }: { 
    children: ReactNode; 
    library: ReactNode; 
    assistant: ReactNode; 
    focusMode: boolean 
}) {
    return <main className={`h-dvh overflow-hidden bg-surface text-ink ${focusMode ? "grid grid-cols-1" : "grid lg:grid-cols-[auto_minmax(0,1fr)_auto]"}`}>
        {!focusMode && library}
        <section className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">{children}</section>
        {!focusMode && assistant}
    </main>;
}
