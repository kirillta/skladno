import { cloneElement, isValidElement, useEffect, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { useIntl } from "react-intl";


const libraryLimits = { default: 208, minimum: 192, maximum: 280, collapsed: 40 };
const assistantLimits = { minimum: 320, collapsed: 48 };
const articleWorkspaceMinimum = 640;
const keyboardIncrement = 16;


function clamp(value: number, minimum: number, maximum: number): number {
    return Math.min(maximum, Math.max(minimum, value));
}


function ResizeHandle({ label, value, minimum, maximum, direction = 1, edge = "end", onChange }: {
    label: string;
    value: number;
    minimum: number;
    maximum: number;
    direction?: 1 | -1;
    edge?: "start" | "end";
    onChange: (value: number) => void;
}) {
    function adjust(value: number) {
        onChange(clamp(value, minimum, maximum));
    }


    function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
        if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
            event.preventDefault();
            adjust(value - keyboardIncrement);
        }

        if (event.key === "ArrowRight" || event.key === "ArrowUp") {
            event.preventDefault();
            adjust(value + keyboardIncrement);
        }

        if (event.key === "Home") {
            event.preventDefault();
            adjust(minimum);
        }

        if (event.key === "End") {
            event.preventDefault();
            adjust(maximum);
        }
    }


    function startResize(event: ReactPointerEvent<HTMLDivElement>) {
        const startX = event.clientX;
        const startValue = value;

        event.currentTarget.setPointerCapture?.(event.pointerId);


        function resize(moveEvent: PointerEvent) {
            adjust(startValue + direction * (moveEvent.clientX - startX));
        }


        function stopResize() {
            window.removeEventListener("pointermove", resize);
            window.removeEventListener("pointerup", stopResize);
        }


        window.addEventListener("pointermove", resize);
        window.addEventListener("pointerup", stopResize, { once: true });
    }


    return <div role="separator" aria-orientation="vertical" aria-label={label} aria-valuemin={minimum} aria-valuemax={maximum} aria-valuenow={value} tabIndex={0} onKeyDown={handleKeyDown} onPointerDown={startResize} className={`absolute inset-y-0 z-10 w-4 cursor-col-resize touch-none before:absolute before:inset-y-0 before:left-1/2 before:w-px before:bg-border hover:before:bg-brand focus-visible:outline-none focus-visible:before:w-0.5 focus-visible:before:bg-brand ${edge === "start" ? "-left-2" : "-right-2"}`} />;
}


export function WorkspaceShell({ children, library, assistant, focusMode, libraryCollapsed, setLibraryCollapsed, assistantCollapsed, setAssistantCollapsed, libraryWidth, setLibraryWidth, assistantWidth, setAssistantWidth }: {
    children: ReactNode;
    library: ReactNode;
    assistant: ReactNode;
    focusMode: boolean;
    libraryCollapsed: boolean;
    setLibraryCollapsed: (collapsed: boolean) => void;
    assistantCollapsed: boolean;
    setAssistantCollapsed: (collapsed: boolean) => void;
    libraryWidth: number;
    setLibraryWidth: (width: number) => void;
    assistantWidth: number;
    setAssistantWidth: (width: number) => void;
}) {
    const intl = useIntl();
    const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
    const requestedLibraryWidth = libraryCollapsed ? libraryLimits.collapsed : libraryWidth;
    const assistantMaximum = Math.min(Math.floor(viewportWidth / 2), viewportWidth - requestedLibraryWidth - articleWorkspaceMinimum);
    // Keep the author's requested width separate from the width that can be rendered
    // in the current viewport. Otherwise clamping it first masks the condition that
    // should temporarily collapse the Assistant Panel.
    const requestedAssistantWidth = Math.max(assistantWidth, assistantLimits.minimum);
    const requiredWidth = requestedLibraryWidth + (assistantCollapsed ? assistantLimits.collapsed : requestedAssistantWidth) + articleWorkspaceMinimum;
    const effectiveAssistantCollapsed = !focusMode && (assistantCollapsed || requiredWidth > viewportWidth);
    const widthWithoutAssistant = (libraryCollapsed ? libraryLimits.collapsed : libraryWidth) + assistantLimits.collapsed + articleWorkspaceMinimum;
    const effectiveLibraryCollapsed = !focusMode && (libraryCollapsed || widthWithoutAssistant > viewportWidth);
    const effectiveLibraryWidth = effectiveLibraryCollapsed ? libraryLimits.collapsed : libraryWidth;
    const effectiveAssistantWidth = effectiveAssistantCollapsed
        ? assistantLimits.collapsed
        : clamp(requestedAssistantWidth, assistantLimits.minimum, assistantMaximum);

    useEffect(() => {
        function updateViewportWidth() {
            setViewportWidth(window.innerWidth);
        }


        window.addEventListener("resize", updateViewportWidth);

        return () => window.removeEventListener("resize", updateViewportWidth);
    }, []);

    return <main className="grid h-dvh overflow-hidden bg-surface text-ink" style={{
        gridTemplateAreas: focusMode ? '"workspace"' : '"library workspace assistant"',
        gridTemplateColumns: focusMode ? "minmax(0, 1fr)" : `${effectiveLibraryWidth}px minmax(0, 1fr) ${effectiveAssistantWidth}px`,
    }}>
        <section className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden" style={{ gridArea: "workspace" }}>{children}</section>
        {!focusMode && <div className="relative min-h-0" style={{ gridArea: "library" }}>
            {isValidElement(library) ? cloneElement(library, { collapsed: effectiveLibraryCollapsed, setCollapsed: setLibraryCollapsed }) : library}
            {!effectiveLibraryCollapsed && <ResizeHandle label={intl.formatMessage({ id: "navigation.resizeArticleLibrary" })} value={libraryWidth} minimum={libraryLimits.minimum} maximum={libraryLimits.maximum} onChange={setLibraryWidth} />}
        </div>}
        {!focusMode && <div className="relative min-h-0" style={{ gridArea: "assistant" }}>
            {isValidElement(assistant) ? cloneElement(assistant, { collapsed: effectiveAssistantCollapsed, setCollapsed: setAssistantCollapsed }) : assistant}
            {!effectiveAssistantCollapsed && <ResizeHandle label={intl.formatMessage({ id: "assistant.resize" })} value={requestedAssistantWidth} minimum={assistantLimits.minimum} maximum={assistantMaximum} direction={-1} edge="start" onChange={setAssistantWidth} />}
        </div>}
    </main>;
}
