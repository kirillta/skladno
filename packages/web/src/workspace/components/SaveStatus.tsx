import { useIntl } from "react-intl";
import type { DraftPresentationState as SaveState } from "../drafts/draft-lifecycle.js";


export function SaveStatus({ saveState }: { saveState: SaveState }) {
    const intl = useIntl();
    const saveLabels: Record<SaveState, string> = {
        saved: intl.formatMessage({ id: "navigation.saved" }),
        unsaved: intl.formatMessage({ id: "navigation.unsaved" }),
        saving: intl.formatMessage({ id: "navigation.savingDraft" }),
        "draft-saved": intl.formatMessage({ id: "navigation.draftSaved" }),
        error: intl.formatMessage({ id: "navigation.saveFailed" }),
        conflict: intl.formatMessage({ id: "navigation.saveConflict" }),
    };
    const saveLabel = saveLabels[saveState];
    const saveTone = saveState === "saved" || saveState === "draft-saved" ? "text-success" : saveState === "unsaved" || saveState === "saving" ? "text-warning" : "text-danger";

    return <span aria-label={saveLabel} className={`ml-2 inline-flex items-center gap-1 text-xs ${saveTone}`} role="status" title={saveLabel}>
        <span aria-hidden="true">&#9679;</span>
        {saveLabel}
    </span>;
}
