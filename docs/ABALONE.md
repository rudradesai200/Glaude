# Abalone — Game Spec

## Overview

2-player hex-grid strategy. Players push opponent marbles off the board. First to push off 6 wins.

## Board

- 61 cells, standard hex layout
- Coordinate system: **axial (q, r)**, derived cube `s = -q - r`
- Constant: `HEX_DIRECTIONS` — 6 unit vectors in axial space

## Marble Counts

- 14 per player at start
- Win condition: opponent has ≤ 8 remaining (6 pushed off)

## Move Types

| Type | Description |
|------|-------------|
| Inline | 1–3 marbles pushed in the column direction |
| Broadside | 1–3 marbles shifted laterally (no push) |
| Sumito | Inline push that moves opponent marbles |

## Move Rules

- Max 3 friendly marbles per move
- Sumito: pushing group must outnumber pushed group (2v1, 3v1, 3v2)
- Cannot push equal or larger groups
- Cannot push own marbles off board
- Broadside cannot push opponent marbles

## Rendering

- Canvas PNG via `@napi-rs/canvas`
- Hex grid with: marble fill colours, border highlights for selected/last-move, axial coordinate labels
- Delivered as Discord message attachment, edited in-place each turn

## Package

`packages/games/abalone/` → `@glaude/game-abalone`

Implements `GameDefinition<AbaloneState, AbaloneMove, AbaloneRenderContext>` from `@glaude/engine`.

## Key Types (expected)

```ts
type AbaloneState = {
  board: Map<string, Cell>;   // key: "q,r"
  turn: PlayerId;
  capturedBy: Record<PlayerId, number>;
  moveNumber: number;
};

type AbaloneMove =
  | { type: "inline"; marbles: AxialCoord[]; direction: HexDir }
  | { type: "broadside"; marbles: AxialCoord[]; direction: HexDir };
```