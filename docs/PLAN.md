# Glaude — Project Plan

## Tech Stack

| Concern | Choice |
|---------|--------|
| Runtime | Bun |
| Discord | discord.js v14 |
| DB | SQLite + Drizzle ORM |
| Monorepo | pnpm workspaces + Turborepo |
| Testing | Vitest |
| Lint/Format | Biome |
| Canvas | @napi-rs/canvas |
| Validation | Zod |

## Monorepo Structure

```
glaude/
├── apps/bot/src/
│   ├── index.ts
│   ├── client.ts
│   ├── commands/
│   ├── events/
│   ├── lobby/
│   ├── session/
│   └── db/
├── packages/
│   ├── engine/          # @glaude/engine — GameDefinition interface
│   ├── games/abalone/   # @glaude/game-abalone
│   ├── discord-ui/      # @glaude/discord-ui
│   └── shared/          # @glaude/shared — Result, errors, branded types
└── docs/
```

## Architecture Decisions

- **GameDefinition<TState, TMove, TRenderContext>** — single interface per game: initial state, move validation/application, legal moves, outcome, turn management, rendering, interaction parsing, component building, serialization
- **Explicit registry** — `apps/bot/src/games/registry.ts`, one import + one line. No auto-discovery.
- **No solo play** — `players.min` typed as literal `2`. Solo-play = compile error.
- **Result<T,E>** — invalid moves are control flow, not exceptions. Infra errors throw `GlaudeError` caught at interaction boundary.
- **Single updatable message** — session edits one Discord message per move
- **Canvas boards** — PNG via @napi-rs/canvas (hex grids need pixel rendering)

## Game Lifecycle

```
CREATED → LOBBY → PLAYING → FINISHED
                     │           │
                  timeout     forfeit
                     ↓           ↓
                 CANCELLED   FORFEITED
```

## DB Schema

| Table | Key Columns |
|-------|-------------|
| players | discord_id (PK), username, created_at |
| game_sessions | id, game_id, channel_id, phase, state (JSON), winner_id, timestamps |
| session_players | session_id, player_id, seat_index |
| move_history | id, session_id, player_id, move_data (JSON), move_number, created_at |
| player_stats | player_id, game_id, wins, losses, draws, elo |

## Discord Commands (MVP)

- `/game start <game>` — create lobby
- `/game join` — join active lobby in channel
- `/game forfeit`
- `/game status` — show current board
- `/stats [user]`
- `/help [game]`

## MVP Scope

**In:** monorepo scaffold, slash commands, lobby/join, full Abalone engine, canvas rendering, turn-by-turn play, win detection, forfeit, SQLite persistence, basic stats, strict TS + Biome + Vitest

**Out:** Elo, leaderboards, replay, spectators, timers, multiple concurrent games, tournaments, additional games, undo/redo, invitations, DM play

## Implementation Phases

| Phase | Description | Depends On |
|-------|-------------|------------|
| 1 | Monorepo scaffold | — |
| 2 | @glaude/shared + @glaude/engine interfaces | 1 |
| 3 | Abalone logic (board, moves, validation, win) | 2 |
| 4 | Canvas board rendering | 3 |
| 5 | Bot: commands, lobby, session, interactions | 2 |
| 6 | Drizzle schema, migrations, session recovery | 5 |
| 7 | Stats, help, timeouts, error handling, docs | 5–6 |