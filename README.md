# Skladno

> Your ideas, in your voice.

Skladno is a local-first writing workspace for technical authors. It helps turn rough notes into a coherent Article, improve the writing, check facts, preserve the author's style, translate the result, and prepare copy for publishing.

The author stays in control. AI output is always a Proposal: Skladno shows the changes, and nothing enters an Article until the author accepts it. Every accepted change creates an immutable Revision.

## What you can do

- Write and autosave Articles locally.
- Ask the Editorial Assistant to compose, revise, fact-check, review style, or translate.
- Review all proposed changes before accepting them.
- Restore earlier Revisions without rewriting history.
- Keep translations as separate linked Articles.
- Preview copy using configurable publishing guidance.
- Manage AI, language, publishing, and backup settings locally.

See the [feature inventory](docs/development/product/feature-inventory.md) for current implementation status and the [glossary](docs/user/Glossary.md) for Skladno's product language.

## How it works

```text
Draft
  -> explicit author request
  -> AI Proposal or Finding
  -> author review
  -> new Revision when accepted
```

Draft checkpoints, Articles, Revisions, settings, and style samples remain local. Credentials stay in the local service and are never exposed to the browser. Network-dependent editorial actions happen only when requested by the author.

## Run locally

Requirements: Node.js 22 or later and npm 10 or later.

```powershell
npm install
npm run dev
```

Open `http://localhost:5173`.

The AI API key is read server-side from `SKLADNO_AI_API_KEY`. Copy `.env.example` to `.env` if you need to configure local ports or AI behavior. Never expose credentials through `VITE_` variables.

Useful checks:

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

## Project structure

- `packages/web`: React interface.
- `packages/server`: local service, AI integration, and SQLite persistence.
- `packages/shared`: domain types and application contracts.
- `packages/electron`: typed desktop bridge.

User documentation lives in [`docs/user`](docs/user). Technical documentation lives in [`docs/development`](docs/development). Product capabilities are maintained in [`product-model`](product-model).

## License

[MIT](LICENSE)
