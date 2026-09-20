import { render, screen } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { beforeAll, expect, it, vi } from "vitest";
import { messages } from "../../../i18n/messages.js";
import { AssistantCheckpointDialog } from "./AssistantCheckpointDialog.js";


beforeAll(() => {
    HTMLDialogElement.prototype.showModal = vi.fn();
    HTMLDialogElement.prototype.close = vi.fn();
});


it("shows only nonzero, non-obvious checkpoint effects", () => {
    render(<IntlProvider locale="en" messages={messages}>
        <AssistantCheckpointDialog
            preview={{ messageId: "message", tailToken: "token", counts: { messages: 2, requests: 1, proposals: 0, findings: 1, translations: 0, retries: 1 }, composer: { text: "Edit", usedSelection: false }, revision: { id: "revision", number: 6, description: "Tightened opening", provenance: { kind: "author-draft" } }, draftDecisionRequired: false }}
            replacingComposer={false}
            close={vi.fn()}
            restore={vi.fn()}
        />
    </IntlProvider>);

    expect(screen.getByText("1 Finding")).toBeDefined();
    expect(screen.getByText('Article content will return to Revision #6, "Tightened opening" (Author Revision). The current and later Revisions remain in Revision History.')).toBeDefined();
    expect(screen.queryByText(/2 messages|Proposal|translation|request|retry/i)).toBeNull();
});
