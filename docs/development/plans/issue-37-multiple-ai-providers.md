# Multiple AI providers, issue #37

Draft implementation plan, 2026-09-05. [Issue #37](https://github.com/kirillta/skladno/issues/37), milestone P11. Dependency #56 is closed and its Settings foundation exists.

## First release

Add OpenCode Zen, Anthropic, Google Gemini API, xAI Grok, and DeepSeek while preserving existing OpenAI connections. OpenCode means its hosted API in this plan. The OpenCode CLI, ACP integration, local models, arbitrary endpoints, and automatic provider failover remain later work.

Expose the full model catalog available through the author's OpenCode connection, including vendors beyond the direct integrations listed above. A model served through OpenCode uses that connection's key and billing; it does not require a separate direct vendor connection. Model availability and support for a particular Editorial Operation are separate decisions.

Use Vercel AI SDK for generation across every integration, extending the existing `ai` engine. Direct connections use `@ai-sdk/anthropic`, `@ai-sdk/google`, `@ai-sdk/xai`, and `@ai-sdk/deepseek` where their supported protocols cover the operation. OpenCode uses the documented model-specific `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google`, or `@ai-sdk/openai-compatible` adapter configured for its endpoint and credentials. Verify package compatibility and operation support before choosing exact versions. Vercel AI Gateway is a separate optional service and is not required. Skladno retains model discovery, credential management, capability policy, source normalization, and completion validation around the common SDK calls.

Use API keys through the existing environment-variable and Windows Credential Manager paths. Claude subscriptions remain excluded by the issue. Evaluate other subscriptions only through documented, permitted API access. OpenCode Go needs confirmation that editorial workloads are eligible before implementation; its documentation describes coding-agent workloads and requires client identification and a session header. Zen is the initial OpenCode path.

## Confirmed implementation gaps

| Owner | Required change |
| --- | --- |
| `packages/shared/src/settings/settings.ts` and Settings service | Connection provider is a string, but creation and configuration behavior still assume OpenAI. Model preferences are global bare model IDs. |
| `configured-editorial-engine-resolver.ts` | Resolves credentials and preferences, then constructs OpenAI implementations regardless of the connection provider. Includes titles, Proposal summaries, and action-intent verification. |
| `ai-sdk-editorial-engine.ts` and `ai-sdk-editorial-helpers.ts` | Construct OpenAI Responses models and require OpenAI response metadata for successful completion. |
| `available-models.ts` | Only an OpenAI endpoint and GPT-family filter exist. |
| `openai-fact-check-provider.ts` | Research uses the currently supported sourced-research adapter. The existing `FactCheckProvider` boundary and workflow can be reused. |
| `application/editorial/editorial-service.ts` | Continuation is stored by Article and receives a completion response ID. Connection and model identity must constrain reuse. |

## Implementation sequence

1. **Define supported connections and migrate preferences.** Use finite provider IDs for this release. Keep one active connection and persist its default, text-generation, Skill overrides, reasoning choices, and favorites per connection. Migrate existing global preferences to the existing active connection, preserving OpenAI behavior and the environment-only fallback. New connections require an appropriate model selection; switching cannot silently reuse another provider's model IDs. Validate shared requests in HTTP and Electron, including managed connection creation. Resolve each running request once so a Settings change affects subsequent requests.

2. **Resolve provider models in infrastructure.** Extend the existing factory and resolver with a small explicit provider switch. Inject the SDK model and the narrowly needed provider behavior into the existing engine. Reuse native AI SDK adapters for Anthropic, Google, and xAI; verify compatible package versions against the installed AI SDK 7 before adding dependencies. Select the smallest supported DeepSeek adapter after checking its required structured-output protocol. Keep SDK objects out of application ports. Route titles, summaries, and action-intent verification through the same provider selection. Preserve their current validation and fallback behavior.

3. **Separate valid completion from continuation.** Validate finish state, required text, structured schemas, domain constraints, cancellation, and stream errors independently of OpenAI metadata. Retain a local completion identity where persistence requires an ID; carry a separate optional provider continuation token. Never send a local completion ID to a provider. Scope continuation to connection, provider, model, Article, and the existing eligible operation rules. Legacy unscoped tokens start fresh. Preserve storage-off defaults, expired-session handling, and fresh requests for translations and fact checks. Enable new provider continuation only after its storage semantics and adapter tests are established.

4. **Add discovery and operation capability checks.** Implement provider-specific model-list authentication and response validation. Keep connection tests free of generation, and retain manual unverified model IDs. Use a small reviewed capability catalog keyed by provider, protocol, and model, with unknown capabilities explicitly unverified. A model-list response alone is not proof of operation support. Record streaming, validated structured output, tool calling, forced tool choice, sourced web research, continuation, reasoning controls, and storage behavior. Reject unsupported operations before sending Article content, with a useful next step. Unknown manual IDs may attempt basic text generation; structured operations, tool-driven actions, and research require established support.

5. **Integrate the five providers in the requested order.** Start with OpenCode Zen and its full available model catalog, then Anthropic, Google, xAI Grok, and DeepSeek. Zen needs model-specific protocol selection, since its documented endpoints include Responses, Messages, Gemini, and Chat Completions. Reuse those protocol adapters for direct providers. Resolve routing from documented model metadata; catalog discovery alone may not provide the required protocol information. New models using supported protocols should not require a new vendor integration or an editorial-model allowlist. Keep Zen capabilities separate from those of the underlying direct vendor. Show unverified capabilities honestly, and mark an unknown protocol unavailable until its routing is supported. Test representative models for each protocol without treating that test set as the selectable catalog.

6. **Expose connections and capabilities in Settings.** Extend existing AI controls with provider selection, provider-specific setup help, per-connection model preferences, and understandable operation availability. Preserve autosave, favorites, manual IDs, credential boundaries, and workspace state. Hide unsupported reasoning controls and preserve saved choices without forwarding incompatible parameters. Follow the UI guardrails and design system during implementation. Provider switching remains explicit; unsupported research offers a connection/model change rather than silently sending content elsewhere.

7. **Verify and document the release.** Update the affected canonical product records only as behavior lands, regenerate inventories, and revise ADR-007 for completion and continuation semantics. Review the new fixed network destinations and storage behavior under ADR-008. Move lasting decisions into the relevant ADRs/guides and remove this plan after completion.

## Agent allocation on a budget

Recommended execution uses one Terra owner and one Luna worker, with at most two implementation agents active. Assign work by code ownership rather than one agent per provider. These are proposed assignments, not agents already launched.

| Stage | Model and reasoning | Deliverable and boundary |
| --- | --- | --- |
| 1. Foundation | Terra, high | Shared contracts, preference migration, resolver, completion/continuation separation, capability policy, and one working SDK protocol path with focused tests. Own shared contracts, transport changes, manifests, and lockfile throughout. |
| 1. Parallel evidence | Luna, medium | Read-only provider matrix covering documented protocols, discovery/authentication, SDK compatibility, and capability/privacy uncertainties. Exact sources and unresolved questions only. No competing architecture or production edits. |
| 2. Provider wiring | Luna, medium | After Terra establishes contracts and an example, add OpenCode catalog/protocol wiring and direct provider adapters in bounded successive tasks, each with focused deterministic tests. Terra owns any required contract or dependency changes. |
| 2. Core integration | Terra, medium; high for persistence changes | While Luna owns provider-specific files, finish auxiliary generators, operation gating, and HTTP/Electron integration. Review new protocols against completion and credential invariants. |
| 3. Settings | Luna, medium | After the backend contract stabilizes, implement provider selection, connection-specific model controls, capability help, and focused UI tests using the existing design system. |
| 3. Integration verification | Terra, high | Review migrations, cancellation, partial output, token isolation, all generation callers, and credential boundaries. Integrate changes and run required repository gates and E2E on a stable combined tree. |
| 4. Documentation | Luna, low or medium | Update product records and guides from verified behavior, regenerate inventories, and report remaining manual checks. Terra checks final consistency. |

Each coding assignment includes its owned files, settled contracts, relevant ADR pointers, acceptance cases, and the smallest required test command. Use fresh bounded context rather than copying the full planning conversation. Workers run focused checks; Terra runs broad gates after integration and repeats them only for relevant changes. Serialize dependency installation and edits to shared files. Parallel work is optional when it would create overlapping ownership.

Escalate Luna to Terra after two failed focused repair attempts on the same cause, or immediately when a contract, persistence, credential, or completion decision is required. Use Sol only for a concrete unresolved design or cross-layer failure that Terra cannot resolve; reserve Astra for an exceptional remaining blocker. Carry the failing test, relevant diff, and attempted fixes into escalation. These are workflow recommendations, not measured model success rates for this repository. No higher-cost standing supervisor or separate agent per provider is needed.

## Capability and privacy decisions

All five providers must pass basic editorial streaming, cancellation, and completion checks with at least one selected model before release. Translation and Style review require validated structured output. Assistant actions require the tool behavior used by the existing tool loop, including forced selection where required. JSON mode alone does not remove local schema validation.

Fact checking requires a research adapter that can return the sources and evidence expected by `FactCheckProvider`. Initially mark unimplemented model capabilities unavailable and tell the Author to choose a capable model or connection, without prescribing a particular provider or silently changing the selected one. A generic search service is outside this first release.

Disabling response storage controls Skladno's requests; it is not a promise of zero vendor retention or training. Review each selected endpoint's published privacy terms, including gateway and free-model exceptions, and expose accurate help before activation. Keep telemetry disabled and sanitize provider errors before transport or diagnostics. No credentials, Article bodies, or provider payloads enter logs or fixtures.

## Acceptance and verification

- Existing OpenAI setup, defaults, overrides, favorites, managed credentials, and environment fallback survive upgrade and restart.
- Each new provider can be created, verified without generation, selected, and used for its supported editorial operations in Electron. Browser development retains its existing credential restrictions.
- OpenCode discovery exposes its full available catalog, including models from vendors without a direct Skladno integration. Refresh can add a model using a known protocol without changing an editorial allowlist; operation capability checks still apply.
- Switching connections isolates preferences and continuation. An in-flight request completes under its original configuration.
- Titles, summaries, action-intent verification, assistant tools, proposals, translations, and Style review use the selected connection and enforce operation requirements.
- Aborted, truncated, empty, malformed, or failed output creates no generated artifact. Successful stateless output does not need an OpenAI response ID.
- Unsupported research or structured output produces a safe actionable error before sending private content. Acceptance still appends an immutable Revision, and translations remain independently recoverable.
- Extend focused resolver, model discovery, engine, Settings, HTTP/IPC, and persistence tests with injected models or fetch fixtures. Cover each supported protocol, malformed discovery data, no credential leakage, migration, and cross-connection token rejection.
- Run focused tests, lint, typecheck, product checks after inventory regeneration, and deterministic E2E for Settings-to-generation journeys. Perform a packaged Windows smoke test and opt-in live checks with synthetic Articles for each provider. Record quality, sources, cancellation, and privacy-setting results without private content.

## Sources and planning checks

- [OpenCode Zen endpoints and privacy](https://opencode.ai/docs/zen/) establish the gateway's per-model protocol selection.
- [OpenCode Go usage and endpoints](https://opencode.ai/docs/go/) describe subscription access, intended workloads, and required client headers. Editorial eligibility remains unresolved.
- [AI SDK providers](https://ai-sdk.dev/providers/ai-sdk-providers) identify existing adapters. Exact options and compatible package versions must be checked during implementation.
- [DeepSeek tool calls](https://api-docs.deepseek.com/guides/tool_calls/) and [Responses API](https://api-docs.deepseek.com/api/create-response/) inform protocol selection; support must be checked per selected model.

Planning included reading issues #37 and #56, tracing Settings, generation, supporting helpers, fact-check research, and continuation owners, and running product impact discovery. Rerun product impact with exact changed file paths during implementation; the initial directory-level query matched only broad application and validation records. No runtime source changes or live provider calls were made for this plan.
