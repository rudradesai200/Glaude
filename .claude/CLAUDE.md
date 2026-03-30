# Glaude — Agent Context

Discord multiplayer games bot for couples/groups. Adding a game = implement one interface + one registry line.

## Context Files
- `docs/backend.md` — bot server architecture, SessionManager, WS protocol, DB schema, packages
- `docs/frontend.md` — React activity app, game context, board interaction, component tree
- `docs/discord.md` — bot vs activity, auth flow, slash commands, env vars, session ID conventions
- `docs/ABALONE.md` — Abalone rules, board representation, move types, rendering spec
- `docs/KeyFiles.md` - Key files for frontend and backend
- `docs/stubs.d.ts` - contains code stubs for the entire project
- `docs/COUP.md` - COUP rules, summary and instructions for development.
- `docs/coup_plan/` - Phase-wise plan of development

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
Bot + activity fully functional. Abalone is multiplayer-only (no AI opponent).
