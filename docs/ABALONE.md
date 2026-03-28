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

## Rendering Spec

**Output:** `Uint8Array` PNG buffer via `@napi-rs/canvas` (installed at `^0.1.97` in `@glaude/game-abalone`)

**Canvas API pattern:**
```ts
import { createCanvas } from "@napi-rs/canvas";
const canvas = createCanvas(width, height);
const ctx = canvas.getContext("2d");
// ... draw ...
return canvas.encode("png"); // returns Promise<Buffer> — Buffer is Uint8Array-compatible
```

**Axial → pixel (flat-top hex, hex radius `R`):**
```
x = centerX + R * 1.5 * q
y = centerY + R * sqrt(3) * (r + q / 2)
```

**What to render:**
- Hex grid cells (61 cells, flat-top orientation)
- Marble fill: seat 0 = black (`#1a1a1a`), seat 1 = white (`#f0f0f0`), empty = board color
- Border highlight on last-moved marbles
- Axial coordinate labels (small text, for debugging/accessibility)
- Board background color distinct from marbles