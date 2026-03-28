import { describe, expect, it } from "vitest";
import { PlayerId } from "@glaude/shared";
import { initialBoard, VALID_CELLS, countMarbles } from "./board.js";

const BLACK = PlayerId("player-black");
const WHITE = PlayerId("player-white");

describe("initialBoard", () => {
  const board = initialBoard(BLACK, WHITE);

  it("has exactly 61 cells", () => {
    expect(board.size).toBe(61);
  });

  it("matches VALID_CELLS exactly", () => {
    expect(board.size).toBe(VALID_CELLS.size);
    for (const key of VALID_CELLS) {
      expect(board.has(key)).toBe(true);
    }
  });

  it("places 14 black marbles", () => {
    expect(countMarbles(board, BLACK)).toBe(14);
  });

  it("places 14 white marbles", () => {
    expect(countMarbles(board, WHITE)).toBe(14);
  });

  it("leaves 33 empty cells", () => {
    let empty = 0;
    for (const cell of board.values()) {
      if (cell.kind === "empty") empty++;
    }
    expect(empty).toBe(33);
  });
});
