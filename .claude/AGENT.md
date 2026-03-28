# Glaude — Agent Context

Discord multiplayer games bot for couples/groups. No solo play, no AI. Adding a game = implement one interface + one registry line.

## Context Files
- `docs/PLAN.md` — architecture, tech stack, DB schema, MVP scope, implementation phases
- `docs/ABALONE.md` — Abalone rules, board representation, move types, rendering
- `docs/TODO.md` — task tracker (update after every step)

## Conventions
- TS strict: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`
- Files: kebab-case | Types: PascalCase | Functions: camelCase | Constants: SCREAMING_SNAKE_CASE
- Packages: `@glaude/` scope | DB columns: snake_case
- Game logic: `Result<T,E>` (no throws) | Infra errors: thrown `GlaudeError`
- Biome: 2-space, double quotes, semicolons, trailing commas

## Workflow
- Plan before executing non-trivial tasks
- Run parallel agents for independent concerns
- Keep all durable context in markdown files, not chat