import { cloneElement, isValidElement, useEffect, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { useIntl } from "react-intl";
import { useFocusAreaNavigation, workspaceFocusAreas } from "../../ui/focus-area-navigation.js";


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


interface WorkspaceShellContent {
    children: ReactNode;
    library: ReactNode;
    assistant: ReactNode;
}


interface WorkspaceShellLayout {
    focusMode: boolean;
    libraryCollapsed: boolean;
    setLibraryCollapsed: (collapsed: boolean) => void;
    assistantCollapsed: boolean;
    setAssistantCollapsed: (collapsed: boolean) => void;
    assistantOpenRequest: number;
    libraryWidth: number;
    setLibraryWidth: (width: number) => void;
    assistantWidth: number;
    setAssistantWidth: (width: number) => void;
}


function calculatePanelLayout(layout: WorkspaceShellLayout, viewportWidth: number, responsiveAssistantExpanded: boolean) {
    const requestedLibraryWidth = layout.libraryCollapsed ? libraryLimits.collapsed : layout.libraryWidth;
    const requestedAssistantWidth = Math.max(layout.assistantWidth, assistantLimits.minimum);
    const requiredWidth = requestedLibraryWidth + (layout.assistantCollapsed ? assistantLimits.collapsed : requestedAssistantWidth) + articleWorkspaceMinimum;
    const assistantCollapsed = !layout.focusMode && (layout.assistantCollapsed || (requiredWidth > viewportWidth && !responsiveAssistantExpanded));
    const assistantOverlay = responsiveAssistantExpanded && viewportWidth < libraryLimits.collapsed + assistantLimits.minimum + articleWorkspaceMinimum;
    const widthWithoutAssistant = requestedLibraryWidth + assistantLimits.collapsed + articleWorkspaceMinimum;
    const expandedAssistantNeedsCollapsedLibrary = responsiveAssistantExpanded && !assistantOverlay && requestedLibraryWidth + assistantLimits.minimum + articleWorkspaceMinimum > viewportWidth;
    const libraryCollapsed = !layout.focusMode && (layout.libraryCollapsed || widthWithoutAssistant > viewportWidth || expandedAssistantNeedsCollapsedLibrary);
    const libraryWidth = libraryCollapsed ? libraryLimits.collapsed : layout.libraryWidth;
    const assistantMaximum = Math.min(Math.floor(viewportWidth / 2), viewportWidth - libraryWidth - articleWorkspaceMinimum);
    const assistantWidth = assistantCollapsed ? assistantLimits.collapsed : clamp(requestedAssistantWidth, assistantLimits.minimum, assistantMaximum);

    return { libraryWidth, libraryCollapsed, assistantWidth: assistantOverlay ? Math.min(requestedAssistantWidth, viewportWidth) : assistantWidth, assistantMaximum, assistantCollapsed, assistantOverlay };
}


export function WorkspaceShell({ content, layout }: { content: WorkspaceShellContent; layout: WorkspaceShellLayout }) {
    const { children, library, assistant } = content;
    const { focusMode, setLibraryCollapsed, assistantCollapsed, setAssistantCollapsed, assistantOpenRequest, libraryWidth, setLibraryWidth, setAssistantWidth } = layout;
    const intl = useIntl();
    const focusAreas = useFocusAreaNavigation(workspaceFocusAreas);
    const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
    const [responsiveAssistantExpanded, setResponsiveAssistantExpanded] = useState(false);
    const panelLayout = calculatePanelLayout(layout, viewportWidth, responsiveAssistantExpanded);

    useEffect(() => {
        function updateViewportWidth() {
            setViewportWidth(window.innerWidth);
        }


        window.addEventListener("resize", updateViewportWidth);

        return () => window.removeEventListener("resize", updateViewportWidth);
    }, []);

    useEffect(() => {
        if (assistantCollapsed)
            setResponsiveAssistantExpanded(false);
        else if (assistantOpenRequest > 0)
            setResponsiveAssistantExpanded(true);
    }, [assistantCollapsed, assistantOpenRequest]);

    return <main ref={focusAreas.ref} onFocusCapture={focusAreas.onFocusCapture} onKeyDownCapture={focusAreas.onKeyDownCapture} className="relative grid h-dvh overflow-hidden bg-surface text-ink" style={{
        gridTemplateAreas: focusMode ? '"workspace"' : '"library workspace assistant"',
        gridTemplateColumns: focusMode ? "minmax(0, 1fr)" : `${panelLayout.libraryWidth}px minmax(0, 1fr) ${panelLayout.assistantOverlay ? 0 : panelLayout.assistantWidth}px`,
    }}>
        <section className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden" style={{ gridArea: "workspace" }}>{children}</section>
        {!focusMode && <div className="relative min-h-0" style={{ gridArea: "library" }}>
            {isValidElement(library) ? cloneElement(library, { collapsed: panelLayout.libraryCollapsed, setCollapsed: setLibraryCollapsed }) : library}
            {!panelLayout.libraryCollapsed && <ResizeHandle label={intl.formatMessage({ id: "navigation.resizeArticleLibrary" })} value={libraryWidth} minimum={libraryLimits.minimum} maximum={libraryLimits.maximum} onChange={setLibraryWidth} />}
        </div>}
        {!focusMode && <div data-responsive-overlay={panelLayout.assistantOverlay || undefined} className={panelLayout.assistantOverlay ? "absolute inset-y-0 right-0 z-20 min-h-0 min-w-0 border-l border-border-strong shadow-raised" : "relative min-h-0 min-w-0"} style={{ gridArea: "assistant", ...(panelLayout.assistantOverlay ? { width: panelLayout.assistantWidth } : {}) }}>
            {isValidElement(assistant) ? cloneElement(assistant, { collapsed: panelLayout.assistantCollapsed, setCollapsed: setAssistantCollapsed }) : assistant}
            {!panelLayout.assistantCollapsed && !panelLayout.assistantOverlay && <ResizeHandle label={intl.formatMessage({ id: "assistant.resize" })} value={panelLayout.assistantWidth} minimum={assistantLimits.minimum} maximum={panelLayout.assistantMaximum} direction={-1} edge="start" onChange={setAssistantWidth} />}
        </div>}
    </main>;
}
