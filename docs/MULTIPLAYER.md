# Multiplayer Abalone Plan

## Context
Extending the 2-player Abalone game to support 3 and 4 players dynamically (lobby size determines player count).

**Rules:**
- Win: first player to push **6 total marbles** off the board (from any opponent)
- Elimination: when a player loses all their marbles, they are removed from the game; their marbles are already gone
- Turn order: round-robin, skipping eliminated players
- Draw: after 200 moves (existing limit)

**Colors:** Black (seat 0) / White (seat 1) / Blue (seat 2) / Red (seat 3)

---

## Starting Positions

### 3-Player — 11 marbles each (33 total), rotationally symmetric 120° wedges

**Seat 0 (Black)** — top-right corner:
```
r=-4: q ∈ {0,1,2,3,4}  → 5 cells
r=-3: q ∈ {0,1,2,3}    → 4 cells
r=-2: q ∈ {1,2}         → 2 cells
```

**Seat 1 (White)** — 120° CCW rotation of Seat 0:
```
(4,0),(3,0),(3,1),(2,1),(1,1),(2,2),(1,2),(0,2),(1,3),(0,3),(0,4)
```

**Seat 2 (Blue)** — 240° CCW rotation of Seat 0:
```
(-4,4),(-3,3),(-4,3),(-3,2),(-2,1),(-4,2),(-3,1),(-2,0),(-4,1),(-3,0),(-4,0)
```

Rotation formulas (axial):
- 120° CCW: `(q, r) → (−q−r, q)`
- 240° CCW: `(q, r) → (r, −q−r)`

### 4-Player — 9 marbles each (36 total), two opposing pairs

**Seat 0 (Black)** — top:
```
(0,-4),
(-1,-3),(0,-3),(1,-3),
(-2,-2),(-1,-2),(0,-2),(1,-2),(2,-2)
```

**Seat 1 (White)** — top-right:
```
(4,-4),(3,-4),(4,-3),(2,-4),(3,-3),(4,-2),(1,-4),(2,-3),(3,-2)
```

**Seat 2 (Blue)** — bottom (180° of Seat 0):
```
(0,4),
(1,3),(0,3),(-1,3),
(2,2),(1,2),(0,2),(-1,2),(-2,2)
```

**Seat 3 (Red)** — bottom-left (180° of Seat 1):
```
(-4,4),(-3,4),(-4,3),(-2,4),(-3,3),(-4,2),(-1,4),(-2,3),(-3,2)
```

---

## Implementation Steps (in dependency order)

### 1. `packages/abalone/src/types.ts`
- Add two fields to `AbaloneState`:
  ```ts
  readonly playerOrder: readonly PlayerId[];  // fixed at game start, never shrinks
  readonly eliminated: readonly PlayerId[];   // grows as players lose all marbles
  ```

### 2. `packages/abalone/src/board.ts`
- Update `initialState(seats: readonly PlayerSeat[])` to switch on `seats.length`:
  - 2P: existing positions (unchanged)
  - 3P: hardcode 3-wedge arrays above
  - 4P: hardcode 4-corner arrays above
  - Otherwise: throw `new Error("Abalone supports 2, 3, or 4 players")`
- Populate `playerOrder: seats.map(s => s.playerId)` and `eliminated: []`.

### 3. `packages/abalone/src/moves.ts`
- **Multi-owner push fix**: when iterating the push chain, record each marble's actual `owner` from the board (not a single `opponent` variable). Credit the *pushing player* for each marble that exits the board.
- **Elimination check**: after updating `capturedBy`, count marbles per player on the new board. Any player reaching 0 is added to `newEliminated`.
- **Turn rotation**: replace single-opponent find with:
  ```ts
  function nextActiveTurn(
    current: PlayerId,
    playerOrder: readonly PlayerId[],
    eliminated: readonly PlayerId[],
  ): PlayerId  // walks playerOrder cyclically, skipping eliminated players
  ```
- **`validateMove`** guard: reject moves from eliminated players.
- Return `playerOrder` (unchanged) and `eliminated` (updated) in new state.
- Export `const DRAW_MOVE_LIMIT = 200`.

### 4. `packages/abalone/src/definition.ts`
- `players: { min: 2, max: 4 }`
- Update `initialState(seats)` call.
- Add `playerOrder` and `eliminated` to `SerializedState`; update serde functions.
- Use `DRAW_MOVE_LIMIT` in `outcome()`.

### 5. `apps/bot/src/session-manager.ts`
- **`forfeit`**: eliminate the forfeiting player rather than immediately ending the game. Only end the session when 1 active player remains.
  - Return type: `Result<EndedSession | PlayingSession, string>`
- **Lobby start**: add `startGame(channelId, hostId)` method so the host can start with 2–4 players in the lobby (replaces auto-start-at-min).

### 6. `apps/bot/src/ws-server.ts`
- `SerializedState.players`: `[string, string]` → `string[]`
- Add `playerOrder: string[]` and `eliminated: string[]` to `SerializedState`
- Update `serializeState` helper
- Handle `EndedSession | PlayingSession` return from `forfeit`
- Add `{ type: "start" }` WS message → `sessionManager.startGame()`

### 7. `apps/activity/src/game-context.tsx`
- `RawState`: update `players?` to `string[]`, add `playerOrder?` and `eliminated?`
- `deserializeState`: pass through the two new fields
- `players` state: `[PlayerId, PlayerId]` → `PlayerId[]`
- Expose `playerOrder` and `eliminated` from context
- Update `initialState` dev-mode call to use `PlayerSeat[]`

### 8. `apps/activity/src/components/BoardSVG.tsx`
- Replace binary black/white color check with a seat-index → color map:
  ```ts
  const MARBLE_COLORS: Record<number, string> = {
    0: "#1a1a1a",  // black
    1: "#f0f0f0",  // white
    2: "#3b82f6",  // blue
    3: "#ef4444",  // red
  };
  ```
- Build `Map<playerId, colorHex>` from `seats` in context; apply per-cell.

### 9. `apps/activity/src/components/HUD.tsx`
- Iterate `playerOrder` to display all players
- Show marble count on board + captures per player
- Grey out / mark eliminated players visually

### 10. Discord command
- Add `/abalone-start` (or extend existing join command) to call `sessionManager.startGame()`, allowing the host to start once 2–4 players have joined

---

## Critical Files
| File | Change |
|------|--------|
| `packages/abalone/src/types.ts` | Add `playerOrder`, `eliminated` to `AbaloneState` |
| `packages/abalone/src/board.ts` | N-player `initialState`/`initialBoard` |
| `packages/abalone/src/moves.ts` | Multi-owner push, elimination, turn rotation |
| `packages/abalone/src/definition.ts` | max:4, serde, outcome |
| `apps/bot/src/session-manager.ts` | N-player forfeit, `startGame` |
| `apps/bot/src/ws-server.ts` | Wire types, serde, start message |
| `apps/activity/src/game-context.tsx` | RawState, players type, initialState |
| `apps/activity/src/components/BoardSVG.tsx` | Color map |
| `apps/activity/src/components/HUD.tsx` | N-player display |

---

## Verification
1. Existing 2P unit tests must still pass (backward-compatible)
2. Unit tests for `initialBoard(3 seats)` and `initialBoard(4 seats)`: verify marble counts, no overlaps, all coords on board
3. Unit tests for `nextActiveTurn` with elimination scenarios
4. Test a 3P push chain where marble belongs to player 2 but player 1 is pushing — verify capture credited to player 1
5. Manual play test in dev Discord server with 3 users
