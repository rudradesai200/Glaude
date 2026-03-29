# AlphaZero AI for Glaude Abalone — Agent Instructions

## Project Overview
Add an AlphaZero AI opponent to the Glaude Discord Activity bot (TypeScript monorepo). The AI runs as a Python sidecar service communicating with the bot over HTTP.

## Repositories
- **Glaude**: TypeScript monorepo — Discord bot, React activity frontend, game engine packages
- **alpha-zero-general** (suragnair/alpha-zero-general): Python framework providing Game, NeuralNet, MCTS, Coach, Arena base classes

---

## Board Geometry
- Standard Abalone hex board: 61 cells, axial coordinates (q, r) where max(|q|, |r|, |q+r|) ≤ 4
- Embed into a 9×9 numpy array using offset (row, col) = (q+4, r+4)
- Board values: +1 = current player's marble, -1 = opponent's, 0 = empty or off-board
- 6 hex directions (E, NE, NW, W, SW, SE) as (dq, dr) vectors
- Map all 61 valid cells to indices 0–60 in row-major scan order for compact indexing

## Action Space (4,026 total actions)
Five move categories, each encoded as an integer offset:
- Single marble inline: 61 cells × 6 directions = 366
- 2-marble inline: 61 tail cells × 6 axis directions = 366
- 3-marble inline: 61 tail cells × 6 axis directions = 366
- 2-marble broadside: 61 tail cells × 6 axis dirs × 4 lateral dirs = 1,464
- 3-marble broadside: 61 tail cells × 6 axis dirs × 4 lateral dirs = 1,464

Lateral directions are the 4 hex directions not parallel to the group axis.

## Symmetries
Dihedral-6 group: 12 symmetries (6 rotations × 2 reflections). Precompute permutation tables for both the 9×9 cell grid and the 4,026-length policy vector.

## Game End Conditions
- Win: opponent has ≤ 8 marbles remaining (6+ pushed off from starting 14)
- Loss: current player has ≤ 8 marbles
- Draw: move limit reached (200 moves), return small epsilon

---

## Files to Create

### `services/alphazero/` (new directory)
Copy framework files (Game.py, NeuralNet.py, MCTS.py, Coach.py, Arena.py, utils.py) from alpha-zero-general into this directory.

**`abalone/AbaloneConstants.py`**
Precomputed at import time: valid cell list (61 entries), cell-to-index dict, hex direction vectors, action size constant (4026), category offset constants, and 12 symmetry permutation tables for both cells and actions.

**`abalone/AbaloneLogic.py`**
Core game logic functions:
- Initial board setup: 14 marbles per side in standard Abalone starting positions
- Valid move generation: return binary vector of length 4,026
- Move execution: decode action integer, resolve inline push (sumito rules) or broadside move, return new board
- Inline push resolution: allow pushing ≤ opponent group size, blocked by own marbles or equal/larger opponent groups
- Game-end detection: count marbles via numpy sum
- Canonical form: multiply board by player (negate for player -1)
- Symmetry application: apply each of 12 permutation tables to board and policy vector
- Board string representation for MCTS hashing
- Action encode/decode functions (integer ↔ category + cell + directions)

**`abalone/AbaloneGame.py`**
Thin subclass of Game that delegates all logic to AbaloneLogic functions. getBoardSize returns (9,9), getActionSize returns 4026.

**`abalone/pytorch/AbaloneNNet.py`**
ResNet architecture with 3-channel input (own marbles, opponent marbles, valid-cell mask), 5 residual blocks at 128 channels with 3×3 kernels. Policy head outputs 4,026 logits; value head outputs a tanh scalar.

**`abalone/pytorch/NNet.py`**
NeuralNet subclass wrapping AbaloneNNet. Converts the 9×9 board to 3-channel tensor in predict(). Implements train, predict, save_checkpoint, load_checkpoint.

**`server.py`**
FastAPI server pre-loading the game, model, and MCTS at startup. Endpoints:
- POST /api/move — accepts board matrix and player, returns chosen action integer and decoded AbaloneMove dict
- POST /api/validate — returns list of valid action indices
- GET /api/health — returns model load status

The move response must match Glaude's AbaloneMove type: `{ type: "inline"|"broadside", marbles: [{q,r},...], direction: {dq,dr} }`.

**`train.py`**
Entry point: instantiate AbaloneGame and NNet, configure Coach args (100 iterations, 50 self-play episodes, 50 MCTS sims, 0.55 update threshold, cpuct 1.5), call coach.learn().

**`requirements.txt`**
torch, numpy, fastapi, uvicorn

---

### `apps/bot/src/ai/alphazero-client.ts` (new file)
HTTP client with two functions:
- stateToMatrix: converts AbaloneState (Map<"q,r", Cell>) to 9×9 number[][] using q+4, r+4 offsets; seat0=+1, seat1=-1
- getAIMove: POST to localhost:8000/api/move, returns AbaloneMove

### `apps/bot/src/commands/game.ts` (edit)
Add an `opponent` string option to the game start subcommand with choices: "human" or "ai".

### `packages/engine/` GameSession (edit)
Add optional `aiSeat` (SeatId) and `aiDifficulty` ("easy"|"medium"|"hard") fields. Difficulty maps to numMCTSSims: easy=10, medium=50, hard=200. After each turn, if aiSeat matches the new current turn, call getAIMove and apply it after a 500ms delay.

### `apps/activity/` React UI (edit)
When current turn belongs to the AI seat, show a pulsing "thinking" indicator and disable move input.

---

## Implementation Order
1. AbaloneConstants.py — tables and offsets
2. AbaloneLogic.py — full game logic with unit tests
3. AbaloneGame.py — framework wrapper
4. Test: verify 14 marbles per side at init, correct legal move count for opening, encode/decode round-trip, win detection, 12 symmetries
5. AbaloneNNet.py and NNet.py
6. train.py — run 10–20 iterations first to validate pipeline
7. server.py — test with curl against known board state
8. alphazero-client.ts and stateToMatrix conversion
9. Bot command and engine session changes
10. Activity UI indicator
11. Dockerize the Python service, add health checks, bundle best.pth.tar checkpoint

## Key Constraints
- Action encode/decode must be bijective across all legal moves
- Push resolution must enforce sumito rules: can only push if attacker group is strictly larger than defender group, push is blocked by own marbles or board edge (marble falls off)
- The stateToMatrix conversion and server-side board representation must agree exactly on which value represents which player
- MCTS tree is NOT preserved between moves (stateless server); this is acceptable for the target response times
- For ONNX migration path: document but do not implement — inference stays in Python for now


## 4 Phases:

Phase 1: Constants + Logic + Game wrapper + unit tests
Phase 2: Neural network (ResNet)
Phase 3: Training pipeline
Phase 4: FastAPI server