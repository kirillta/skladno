# Skladno editorial workflows inventory

| Area | Feature | Status | Owner / contract |
|---|---|---|---|
| Assistant panel | Editorial guidance composer and Stages menu | Implemented | `EditorialAssistantPanel`; selecting a Stage persists only advisory workflow metadata and selects an aligned pending operation. Send still requires explicit guidance and remains the sole request trigger. |
| Assistant panel | Streamed responses, progress, cancellation, and error recovery | Implemented | Editorial route and SSE client; incomplete streams do not modify the Article. |
| Editorial operations | Thesis-to-narrative composition | Implemented | Server editorial engine; output remains a Proposal until acceptance. |
| Editorial operations | Flow revision | Implemented | Server editorial engine; generated changes are reviewable. |
| Editorial operations | Fact-check request | Implemented | LangGraph fact-check workflow; findings are advisory, Revision-tied, and retain their own freshness state. |
| Editorial operations | Style review | Implemented | Style-aware editorial engine; raw style samples remain local and the review retains its own freshness state. |
| Editorial operations | Translation request | Implemented | Translation engine and linked Article flow; source Article is never overwritten. |
| Proposal lifecycle | Diff review, per-change selection, full/partial acceptance, rejection, stale warning | Implemented | `ProposalReviewView`; acceptance creates one immutable Revision and stale proposals cannot be accepted. |
| AI safety | Explicit request and explicit proposal approval | Implemented | Assistant, Proposal, and Revision boundaries; AI text is never silently applied. |
| AI connection | Named OpenAI connections, active connection, testing, environment-variable references | Partial | Settings route/repository and server config; secrets stay server-side, but management/provider breadth is incomplete. |
| AI model selection | Refreshed model list, default model, operation-specific overrides | Implemented | Settings route/repository and editorial resolution; model list is refreshed but not persisted. |
