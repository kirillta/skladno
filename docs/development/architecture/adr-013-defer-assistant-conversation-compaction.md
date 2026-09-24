# ADR-013: Defer Assistant conversation compaction

- Status: Proposed
- Date: 2026-09-24
- Scope: Assistant conversation context
- Depends on: [ADR-005](adr-005-article-state-and-consistency.md), [ADR-007](adr-007-completion-gated-editorial-engine.md), [ADR-011](adr-011-assistant-skills-and-bounded-capabilities.md)
- Investigation: [issue #233](https://github.com/kirillta/skladno/issues/233)

## Context

Each Article has a durable local Assistant transcript. `AssistantCapabilityLoop` sends the latest 12 eligible Author and completed Assistant response messages to the configured Assistant model. `getConversationHistory` omits greetings, status messages, and generated artifacts. The Assistant's current request is also appended separately. The full transcript remains local and visible; the 12 message limit only changes what the model receives. The fallback conversation path has no message count limit. Neither path has a token budget, so a few long messages, loaded Skill instructions, or tool results can still exceed a model's context window. The current Author message is stored before history is read, so the capability path also includes that message in history and again as the current request.

There is no recorded evidence yet that long Assistant conversations are causing context-limit failures or measurable loss of useful context for Authors. The existing message window can forget an earlier decision after six short exchanges, but no failure rate or quality threshold has been established. The six-step tool loop bounds work within a request; it does not bound the size of a message or tool result.

## Decision

Do not add automatic conversation compaction now. Keep the local transcript and checkpoint behavior intact. First fix the duplicate current-message input and apply one consistent, bounded prompt policy to both conversation paths if context pressure is observed. Measure privacy-safe request size, model/provider, context-limit failures, latency, and whether Authors must repeat an earlier instruction. Do not log message text, Article content, Skill instructions, tool arguments, or raw provider errors.

Reconsider compaction when real use or deterministic long-conversation tests show either repeated context-limit failures or loss of earlier Author intent that a bounded recent-message window cannot address. Compare the affected model's documented context limit with the entire request, including system instructions, Skills, tool schemas, tool results, current request, and output reserve. A message count alone is not a reliable threshold across providers or models.

If compaction becomes necessary, use a provider-neutral, locally stored summary of older completed turns plus recent verbatim turns. Make the summary inspectable and correctable by the Author before it is used. Keep the original transcript and checkpoint anchors unchanged. Track which transcript range and current Revision the summary covers; invalidate or rebuild it after checkpoint restoration, a changed Revision, or a correction. Summaries are context hints, never authority to mutate an Article or proof that a tool ran. Generate and persist a summary only after valid completion; failure or cancellation leaves the previous context intact. Limit summary input to the conversation content needed for the explicit Assistant request and honor the selected provider's storage setting.

## Alternatives considered

| Approach | Benefit | Cost or limitation |
| --- | --- | --- |
| Recent verbatim messages, current behavior | Simple, local, provider-neutral, easy to recover | Forgets older decisions; count does not bound tokens |
| Provider-native compaction | Can manage long provider sessions with less application code | Provider-specific state and format; some output is opaque, which prevents Author inspection or correction; compatibility and retention differ |
| Provider-neutral summarization | Inspectable and portable across configured providers and models | Extra model call, latency, cost, and risk of omitting or changing Author intent; needs invalidation and recovery rules |

Provider-native mechanisms remain optional adapter optimizations only if a future provider-neutral behavior is established. OpenAI's Responses compaction can carry an opaque encrypted item and supports `store=false`, while Anthropic's on-demand mechanism returns a signed summary block. Neither is a common local summary format. AI SDK message pruning removes selected prior content; it does not preserve the omitted Author decisions. See [OpenAI compaction](https://developers.openai.com/api/docs/guides/compaction), [Claude compaction on demand](https://platform.claude.com/docs/en/build-with-claude/compaction-on-demand), and [AI SDK pruning](https://ai-sdk.dev/docs/reference/ai-sdk-ui/prune-messages).

## Consequences

The present Assistant can lose distant context or fail on unusually large inputs. That risk is explicit until it is measured. The transcript, Article Revisions, Drafts, and checkpoint restoration keep their current recovery guarantees. No provider-side conversation storage is added. A future compaction change needs provider compatibility, Author review, stale-summary handling, completion and cancellation tests, and recovery tests before release.
