import { describe, expect, it } from "vitest";
import { PlayerId } from "@glaude/shared";
import { coordKey, initialState, step } from "./board.js";
import { validateMove, applyMove, isWon, legalMoves } from "./moves.js";
import type { AbaloneState, AbaloneMove, Cell, HexDir } from "./types.js";

const BLACK = PlayerId("black");
const WHITE = PlayerId("white");

// ─── board builder helpers ────────────────────────────────────────────────────

/** Build a minimal AbaloneState with only the specified marbles on a full empty board. */
function makeState(
  marbles: Array<{ q: number; r: number; owner: PlayerId }>,
  turn: PlayerId,
  capturedBy: Record<string, number> = { [BLACK]: 0, [WHITE]: 0 },
): AbaloneState {
  // Start from the full initial board to get all valid cells as empty
  const base = initialState(BLACK, WHITE);
  const board = new Map<string, Cell>();
  for (const [k] of base.board) {
    board.set(k, { kind: "empty" });
  }
  for (const { q, r, owner } of marbles) {
    board.set(coordKey({ q, r }), { kind: "marble", owner });
  }
  return { board, turn, capturedBy, moveNumber: 0 };
}

// ─── validateMove ─────────────────────────────────────────────────────────────

describe("validateMove — turn enforcement", () => {
  it("rejects move when it is not the player's turn", () => {
    const state = makeState([{ q: 0, r: 0, owner: BLACK }], WHITE);
    const move: AbaloneMove = { type: "inline", marbles: [{ q: 0, r: 0 }], direction: 0 };
    const result = validateMove(state, move);
    expect(result.ok).toBe(false);
  });
});

describe("validateMove — marble count", () => {
  it("rejects 0 marbles", () => {
    const state = makeState([], BLACK);
    const move: AbaloneMove = { type: "inline", marbles: [], direction: 0 };
    expect(validateMove(state, move).ok).toBe(false);
  });

  it("rejects 4 marbles", () => {
    const state = makeState(
      [
        { q: -1, r: 0, owner: BLACK },
        { q: 0, r: 0, owner: BLACK },
        { q: 1, r: 0, owner: BLACK },
        { q: 2, r: 0, owner: BLACK },
      ],
      BLACK,
    );
    const move: AbaloneMove = {
      type: "inline",
      marbles: [{ q: -1, r: 0 }, { q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 }],
      direction: 0,
    };
    expect(validateMove(state, move).ok).toBe(false);
  });
});

describe("validateMove — ownership", () => {
  it("rejects opponent marbles", () => {
    const state = makeState([{ q: 0, r: 0, owner: WHITE }], BLACK);
    const move: AbaloneMove = { type: "inline", marbles: [{ q: 0, r: 0 }], direction: 0 };
    expect(validateMove(state, move).ok).toBe(false);
  });
});

describe("validateMove — inline: single marble", () => {
  it("allows moving to an empty adjacent cell", () => {
    const state = makeState([{ q: 0, r: 0, owner: BLACK }], BLACK);
    const move: AbaloneMove = { type: "inline", marbles: [{ q: 0, r: 0 }], direction: 0 };
    expect(validateMove(state, move).ok).toBe(true);
  });

  it("rejects moving off the board", () => {
    // Place at edge: q=4, r=0 is on the board; moving E (dir 0) takes it off
    const state = makeState([{ q: 4, r: 0, owner: BLACK }], BLACK);
    const move: AbaloneMove = { type: "inline", marbles: [{ q: 4, r: 0 }], direction: 0 };
    expect(validateMove(state, move).ok).toBe(false);
  });

  it("rejects moving into own marble", () => {
    const state = makeState(
      [{ q: 0, r: 0, owner: BLACK }, { q: 1, r: 0, owner: BLACK }],
      BLACK,
    );
    // Moving single marble at (0,0) east into own marble at (1,0)
    const move: AbaloneMove = { type: "inline", marbles: [{ q: 0, r: 0 }], direction: 0 };
    expect(validateMove(state, move).ok).toBe(false);
  });
});

describe("validateMove — inline: consecutive check", () => {
  it("rejects non-consecutive marbles for inline", () => {
    // (0,0) and (2,0) are not consecutive (gap at (1,0))
    const state = makeState(
      [{ q: 0, r: 0, owner: BLACK }, { q: 2, r: 0, owner: BLACK }],
      BLACK,
    );
    const move: AbaloneMove = {
      type: "inline",
      marbles: [{ q: 0, r: 0 }, { q: 2, r: 0 }],
      direction: 0,
    };
    expect(validateMove(state, move).ok).toBe(false);
  });

  it("accepts consecutive 2-marble inline push to empty cell", () => {
    const state = makeState(
      [{ q: 0, r: 0, owner: BLACK }, { q: 1, r: 0, owner: BLACK }],
      BLACK,
    );
    const move: AbaloneMove = {
      type: "inline",
      marbles: [{ q: 0, r: 0 }, { q: 1, r: 0 }],
      direction: 0,
    };
    expect(validateMove(state, move).ok).toBe(true);
  });
});

describe("validateMove — sumito (inline push of opponent marbles)", () => {
  it("allows 2v1 sumito", () => {
    // BLACK: (0,0),(1,0); WHITE: (2,0). BLACK pushes E → valid
    const state = makeState(
      [
        { q: 0, r: 0, owner: BLACK },
        { q: 1, r: 0, owner: BLACK },
        { q: 2, r: 0, owner: WHITE },
      ],
      BLACK,
    );
    const move: AbaloneMove = {
      type: "inline",
      marbles: [{ q: 0, r: 0 }, { q: 1, r: 0 }],
      direction: 0,
    };
    expect(validateMove(state, move).ok).toBe(true);
  });

  it("allows 3v1 sumito", () => {
    const state = makeState(
      [
        { q: -1, r: 0, owner: BLACK },
        { q: 0, r: 0, owner: BLACK },
        { q: 1, r: 0, owner: BLACK },
        { q: 2, r: 0, owner: WHITE },
      ],
      BLACK,
    );
    const move: AbaloneMove = {
      type: "inline",
      marbles: [{ q: -1, r: 0 }, { q: 0, r: 0 }, { q: 1, r: 0 }],
      direction: 0,
    };
    expect(validateMove(state, move).ok).toBe(true);
  });

  it("allows 3v2 sumito", () => {
    const state = makeState(
      [
        { q: -1, r: 0, owner: BLACK },
        { q: 0, r: 0, owner: BLACK },
        { q: 1, r: 0, owner: BLACK },
        { q: 2, r: 0, owner: WHITE },
        { q: 3, r: 0, owner: WHITE },
      ],
      BLACK,
    );
    const move: AbaloneMove = {
      type: "inline",
      marbles: [{ q: -1, r: 0 }, { q: 0, r: 0 }, { q: 1, r: 0 }],
      direction: 0,
    };
    expect(validateMove(state, move).ok).toBe(true);
  });

  it("rejects 2v2 sumito (equal groups)", () => {
    const state = makeState(
      [
        { q: 0, r: 0, owner: BLACK },
        { q: 1, r: 0, owner: BLACK },
        { q: 2, r: 0, owner: WHITE },
        { q: 3, r: 0, owner: WHITE },
      ],
      BLACK,
    );
    const move: AbaloneMove = {
      type: "inline",
      marbles: [{ q: 0, r: 0 }, { q: 1, r: 0 }],
      direction: 0,
    };
    expect(validateMove(state, move).ok).toBe(false);
  });

  it("rejects 1v1 sumito (no numerical advantage)", () => {
    const state = makeState(
      [
        { q: 0, r: 0, owner: BLACK },
        { q: 1, r: 0, owner: WHITE },
      ],
      BLACK,
    );
    const move: AbaloneMove = {
      type: "inline",
      marbles: [{ q: 0, r: 0 }],
      direction: 0,
    };
    expect(validateMove(state, move).ok).toBe(false);
  });

  it("rejects sumito when opponent marbles are blocked behind", () => {
    // BLACK: (0,0),(1,0); WHITE: (2,0),(3,0); BLACK marble at (4,0) behind whites
    // Wait — (4,0) is on board and has a marble behind opponent → blocked
    const state = makeState(
      [
        { q: 0, r: 0, owner: BLACK },
        { q: 1, r: 0, owner: BLACK },
        { q: 2, r: 0, owner: WHITE },
        { q: 4, r: 0, owner: BLACK }, // blocks the push
      ],
      BLACK,
    );
    // BLACK: (0,0),(1,0) tries to push WHITE (2,0), but (4,0) is occupied by another marble
    // Actually: (3,0) is empty, so let's put the blocker at (3,0)
    const state2 = makeState(
      [
        { q: 0, r: 0, owner: BLACK },
        { q: 1, r: 0, owner: BLACK },
        { q: 2, r: 0, owner: WHITE },
        { q: 3, r: 0, owner: BLACK }, // marble behind white at destination
      ],
      BLACK,
    );
    const move: AbaloneMove = {
      type: "inline",
      marbles: [{ q: 0, r: 0 }, { q: 1, r: 0 }],
      direction: 0,
    };
    expect(validateMove(state2, move).ok).toBe(false);
  });

  it("allows sumito that pushes opponent marble off board (capture)", () => {
    // WHITE at (4,0) — off board to the east; BLACK at (2,0),(3,0) push east
    const state = makeState(
      [
        { q: 2, r: 0, owner: BLACK },
        { q: 3, r: 0, owner: BLACK },
        { q: 4, r: 0, owner: WHITE },
      ],
      BLACK,
    );
    const move: AbaloneMove = {
      type: "inline",
      marbles: [{ q: 2, r: 0 }, { q: 3, r: 0 }],
      direction: 0,
    };
    expect(validateMove(state, move).ok).toBe(true);
  });
});

describe("validateMove — broadside", () => {
  it("allows 2-marble broadside to empty cells", () => {
    // BLACK: (0,0),(1,0) — horizontal line; move SE (dir 5) which is perpendicular
    const state = makeState(
      [{ q: 0, r: 0, owner: BLACK }, { q: 1, r: 0, owner: BLACK }],
      BLACK,
    );
    // dir 5 (SE): axis 5%3=2, line axis 0%3=0, different → valid
    const move: AbaloneMove = {
      type: "broadside",
      marbles: [{ q: 0, r: 0 }, { q: 1, r: 0 }],
      direction: 5 as HexDir,
    };
    expect(validateMove(state, move).ok).toBe(true);
  });

  it("rejects broadside parallel to marble line axis", () => {
    // BLACK: (0,0),(1,0) — E/W axis (axis 0); move east (dir 0) is parallel
    const state = makeState(
      [{ q: 0, r: 0, owner: BLACK }, { q: 1, r: 0, owner: BLACK }],
      BLACK,
    );
    const move: AbaloneMove = {
      type: "broadside",
      marbles: [{ q: 0, r: 0 }, { q: 1, r: 0 }],
      direction: 0 as HexDir,
    };
    expect(validateMove(state, move).ok).toBe(false);
  });

  it("rejects broadside that moves a marble off the board", () => {
    // BLACK: (3,0),(4,0) — line along axis 0; move NE (dir 1, perpendicular)
    // (4,0) + NE = (5,-1) which is off board
    const state = makeState(
      [{ q: 3, r: 0, owner: BLACK }, { q: 4, r: 0, owner: BLACK }],
      BLACK,
    );
    const move: AbaloneMove = {
      type: "broadside",
      marbles: [{ q: 3, r: 0 }, { q: 4, r: 0 }],
      direction: 1 as HexDir,
    };
    expect(validateMove(state, move).ok).toBe(false);
  });

  it("rejects broadside into opponent marble (no pushing)", () => {
    // BLACK: (0,0),(1,0); WHITE at (0,-1) — SE of (0,0) is dir=2 NW...
    // Let's use: BLACK (0,0),(1,0), WHITE at (1,-1). Move NE dir=1: (0,0)→(1,-1) occupied
    const state = makeState(
      [
        { q: 0, r: 0, owner: BLACK },
        { q: 1, r: 0, owner: BLACK },
        { q: 1, r: -1, owner: WHITE },
      ],
      BLACK,
    );
    const move: AbaloneMove = {
      type: "broadside",
      marbles: [{ q: 0, r: 0 }, { q: 1, r: 0 }],
      direction: 1 as HexDir, // NE
    };
    expect(validateMove(state, move).ok).toBe(false);
  });

  it("rejects non-collinear marbles for broadside", () => {
    // (0,0), (1,0), (0,-1) form an L-shape — not collinear
    const state = makeState(
      [
        { q: 0, r: 0, owner: BLACK },
        { q: 1, r: 0, owner: BLACK },
        { q: 0, r: -1, owner: BLACK },
      ],
      BLACK,
    );
    const move: AbaloneMove = {
      type: "broadside",
      marbles: [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 0, r: -1 }],
      direction: 5 as HexDir,
    };
    expect(validateMove(state, move).ok).toBe(false);
  });
});

// ─── applyMove ────────────────────────────────────────────────────────────────

describe("applyMove", () => {
  it("moves a single marble to adjacent empty cell", () => {
    const state = makeState([{ q: 0, r: 0, owner: BLACK }], BLACK);
    const move: AbaloneMove = { type: "inline", marbles: [{ q: 0, r: 0 }], direction: 0 };
    const next = applyMove(state, move);
    expect(next.board.get(coordKey({ q: 0, r: 0 }))?.kind).toBe("empty");
    expect(next.board.get(coordKey({ q: 1, r: 0 }))).toEqual({ kind: "marble", owner: BLACK });
  });

  it("switches turn after move", () => {
    const state = makeState([{ q: 0, r: 0, owner: BLACK }], BLACK);
    const move: AbaloneMove = { type: "inline", marbles: [{ q: 0, r: 0 }], direction: 0 };
    const next = applyMove(state, move);
    expect(next.turn).toBe(WHITE);
  });

  it("increments moveNumber", () => {
    const state = makeState([{ q: 0, r: 0, owner: BLACK }], BLACK);
    const move: AbaloneMove = { type: "inline", marbles: [{ q: 0, r: 0 }], direction: 0 };
    expect(applyMove(state, move).moveNumber).toBe(1);
  });

  it("inline push moves opponent marble", () => {
    // BLACK (0,0),(1,0) push east → WHITE (2,0) moves to (3,0)
    const state = makeState(
      [
        { q: 0, r: 0, owner: BLACK },
        { q: 1, r: 0, owner: BLACK },
        { q: 2, r: 0, owner: WHITE },
      ],
      BLACK,
    );
    const move: AbaloneMove = {
      type: "inline",
      marbles: [{ q: 0, r: 0 }, { q: 1, r: 0 }],
      direction: 0,
    };
    const next = applyMove(state, move);
    expect(next.board.get(coordKey({ q: 2, r: 0 }))).toEqual({ kind: "marble", owner: BLACK });
    expect(next.board.get(coordKey({ q: 3, r: 0 }))).toEqual({ kind: "marble", owner: WHITE });
    expect(next.capturedBy[BLACK]).toBe(0);
  });

  it("captures opponent marble pushed off board", () => {
    // BLACK (2,0),(3,0) push WHITE (4,0) off board east
    const state = makeState(
      [
        { q: 2, r: 0, owner: BLACK },
        { q: 3, r: 0, owner: BLACK },
        { q: 4, r: 0, owner: WHITE },
      ],
      BLACK,
    );
    const move: AbaloneMove = {
      type: "inline",
      marbles: [{ q: 2, r: 0 }, { q: 3, r: 0 }],
      direction: 0,
    };
    const next = applyMove(state, move);
    expect(next.capturedBy[BLACK]).toBe(1);
    // WHITE marble no longer on board
    for (const [, cell] of next.board) {
      if (cell.kind === "marble" && cell.owner === WHITE) {
        expect(true).toBe(false); // should not exist
      }
    }
  });

  it("broadside moves all marbles laterally without capturing", () => {
    // BLACK: (0,0),(1,0); move SE dir=5
    const state = makeState(
      [{ q: 0, r: 0, owner: BLACK }, { q: 1, r: 0, owner: BLACK }],
      BLACK,
    );
    const move: AbaloneMove = {
      type: "broadside",
      marbles: [{ q: 0, r: 0 }, { q: 1, r: 0 }],
      direction: 5 as HexDir,
    };
    const next = applyMove(state, move);
    // dir 5 = SE = {q:0, r:1}
    expect(next.board.get(coordKey({ q: 0, r: 1 }))).toEqual({ kind: "marble", owner: BLACK });
    expect(next.board.get(coordKey({ q: 1, r: 1 }))).toEqual({ kind: "marble", owner: BLACK });
    expect(next.board.get(coordKey({ q: 0, r: 0 }))?.kind).toBe("empty");
    expect(next.board.get(coordKey({ q: 1, r: 0 }))?.kind).toBe("empty");
    expect(next.capturedBy[BLACK]).toBe(0);
  });
});

// ─── isWon ────────────────────────────────────────────────────────────────────

describe("isWon", () => {
  it("returns null when no player has 6 captures", () => {
    const state = makeState([], BLACK, { [BLACK]: 5, [WHITE]: 0 });
    expect(isWon(state)).toBe(null);
  });

  it("returns winner when they have exactly 6 captures", () => {
    const state = makeState([], BLACK, { [BLACK]: 6, [WHITE]: 0 });
    expect(isWon(state)).toBe(BLACK);
  });

  it("returns winner when they have more than 6 captures", () => {
    const state = makeState([], WHITE, { [BLACK]: 0, [WHITE]: 7 });
    expect(isWon(state)).toBe(WHITE);
  });
});

// ─── legalMoves ───────────────────────────────────────────────────────────────

describe("legalMoves", () => {
  it("returns a non-empty list from initial position", () => {
    const state = initialState(BLACK, WHITE);
    const moves = legalMoves(state);
    expect(moves.length).toBeGreaterThan(0);
  });

  it("all returned moves pass validateMove", () => {
    const state = initialState(BLACK, WHITE);
    const moves = legalMoves(state);
    for (const move of moves) {
      expect(validateMove(state, move).ok).toBe(true);
    }
  });

  it("returns empty list when no marbles exist for current player", () => {
    const state = makeState([{ q: 0, r: 0, owner: WHITE }], BLACK);
    const moves = legalMoves(state);
    expect(moves.length).toBe(0);
  });

  it("returns only inline moves for a single marble", () => {
    // A marble in the center can move in up to 6 directions
    const state = makeState([{ q: 0, r: 0, owner: BLACK }], BLACK);
    const moves = legalMoves(state);
    expect(moves.every((m) => m.type === "inline")).toBe(true);
    expect(moves.length).toBe(6);
  });
});
