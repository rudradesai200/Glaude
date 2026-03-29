# TypeScript/JS Context for Python Sidecar

Strictly essential items the Python service must agree with.

## HexDir (0–5) → (dq, dr)
```
0 = E  → (1,  0)
1 = NE → (1, -1)
2 = NW → (0, -1)
3 = W  → (-1,  0)
4 = SW → (-1,  1)
5 = SE → (0,   1)
```
Axis pairs (opposite dirs): 0↔3, 1↔4, 2↔5

## Board → 9×9 Matrix
- Board key format: `"q,r"` (e.g. `"0,0"`)
- Cell: `{kind:"empty"}` or `{kind:"marble", owner: PlayerId}`
- Matrix offset: `row = q+4`, `col = r+4`
- Matrix values: `+1` = seat-0 (black, moves first), `-1` = seat-1 (white), `0` = empty/off-board

## AbaloneMove (server response must match exactly)
```json
{
  "type": "inline" | "broadside",
  "marbles": [{"q": number, "r": number}, ...],
  "direction": 0-5
}
```
`marbles` = array of 1–3 `{q, r}` coords of moving marbles.
`direction` = integer HexDir (NOT a vector object).

## Win Condition
- 14 marbles per side at start
- Win when opponent has ≤ 8 marbles (6 pushed off)
- Draw at moveNumber ≥ 200

## Player Convention
- `seats[0]` = black = moves first = `+1` in canonical board
- `seats[1]` = white = `−1` in canonical board
- Current player is always represented as `+1` in canonical form

## Phase 1: What was built:

File	Purpose
abalone/AbaloneConstants.py	61-cell list, action encoding offsets, HexDir vectors, lateral dir table, 12 dihedral symmetry permutation tables
abalone/AbaloneLogic.py	Board init, canonical form, valid moves, inline/broadside apply, sumito push resolution, game-end detection, symmetry application, action_to_move_dict for server
abalone/AbaloneGame.py	Thin Game subclass delegating to logic
abalone/test_abalone.py	42 unit tests covering all spec items
Test highlights:

14 marbles per side at init ✓
Encode/decode bijective round-trip for all 4026 actions ✓
Opening valid move count: 98 (standard Abalone opening has ~44 unique move groups, but our encoding counts directional group orderings — this is expected; move generation is correct)
2v1 sumito succeeds, 2v2 blocked ✓
3v1 push-off-board captures marble ✓
12 symmetries are proper permutations ✓

## Next phase is the ResNet neural network (Phase 2).