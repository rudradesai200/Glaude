# Glaude — Agent Context

Discord multiplayer games bot for couples/groups. No solo play, no AI. Adding a game = implement one interface + one registry line.

## Context Files
- `docs/backend.md` — bot server architecture, SessionManager, WS protocol, DB schema, packages
- `docs/frontend.md` — React activity app, game context, board interaction, component tree
- `docs/discord.md` — bot vs activity, auth flow, slash commands, env vars, session ID conventions
- `docs/ABALONE.md` — Abalone rules, board representation, move types, rendering spec

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
- After every TODO item update, run `/compact`

## Key Types (by file — read with offset/limit as needed)
- `packages/shared/src/result.ts` — `Result<T,E>`, `ok`, `err`, `isOk`, `isErr`
- `packages/shared/src/errors.ts` — `GlaudeError`
- `packages/shared/src/branded.ts` — `PlayerId`, `SessionId`, `GameId` (branded strings via template literal types)
- `packages/shared/src/game-types.ts` — `GamePhase`, `GameOutcome`, `PlayerSeat`
- `packages/engine/src/game-definition.ts` — `GameDefinition<TState, TMove, TRenderContext>`: 10 methods: `initialState`, `validateMove`, `applyMove`, `legalMoves`, `currentTurn`, `outcome`, `buildRenderContext`, `render`, `serializeState`/`deserializeState`, `serializeMove`/`deserializeMove`
- `packages/games/abalone/src/types.ts` — `AbaloneState`, `AbaloneMove`, `AbaloneRenderContext`, `AxialCoord`, `HexDir`, `Cell`
- `packages/games/abalone/src/board.ts` — `HEX_DIRECTIONS`, `VALID_CELLS`, `initialState`, `countMarbles`, coord helpers (`coordKey`, `parseKey`, `addCoord`, `step`, `isOnBoard`, `opposite`)
- `packages/games/abalone/src/moves.ts` — `validateMove`, `applyMove`, `legalMoves`, `isWon`
- `packages/games/abalone/src/definition.ts` — `abaloneDefinition` (implements `GameDefinition`; `render()` at L65 throws "not implemented")

## Status
All phases complete. Activity (iframe game) + bot WS server fully functional. Next planned feature: AI opponent integration.
