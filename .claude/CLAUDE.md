# Glaude — Agent Context

Discord multiplayer games bot for couples/groups. Adding a game = implement one interface + one registry line.

## Context Files
- `docs/backend.md` — bot server architecture, SessionManager, WS protocol, DB schema, packages
- `docs/frontend.md` — React activity app, game context, board interaction, component tree
- `docs/discord.md` — bot vs activity, auth flow, slash commands, env vars, session ID conventions
- `docs/ABALONE.md` — Abalone rules, board representation, move types, rendering spec
- `docs/KeyFiles.md` - Key files for frontend and backend
- `docs/stubs.d.ts` - contains code stubs for the entire project
- `services/alphazero/TS_CONTEXT.md` - contains all relevant context on what needs to be read form the JS files.

## Conventions
- TS strict: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`
- Files: kebab-case | Types: PascalCase | Functions: camelCase | Constants: SCREAMING_SNAKE_CASE
- Packages: `@glaude/` scope | DB columns: snake_case
- Game logic: `Result<T,E>` (no throws) | Infra errors: thrown `GlaudeError`
- Biome: 2-space, double quotes, semicolons, trailing commas

## Strict Guidelines
- Don't read all files just to get context. Infer context based on the docs and stubs as much as possible.
- You don't need to read the entire code just to get context.

## Workflow
- Plan before executing non-trivial tasks
- Keep all durable context in markdown files, not chat
- After every few commands `/compact`

## Status
Bot + activity fully functional. AI opponent integration in progress.
- Phase 1 (Constants + Logic + Game + tests): **DONE** — `services/alphazero/abalone/`
- Phase 2 (ResNet neural network): **DONE** — `services/alphazero/abalone/pytorch/`
- Phase 3 (Training pipeline): **DONE** — `services/alphazero/abalone/train.py`
- Phase 4 (FastAPI server): **DONE** — `services/alphazero/server.py`
- Phase 5 (Bot ↔ sidecar wiring): **NEXT**
