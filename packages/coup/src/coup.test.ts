import { describe, expect, it } from "vitest";
import { PlayerId } from "@glaude/shared";
import { initialState, getPlayer, influenceCount, activePlayers, currentActor } from "./state.js";
import { legalMoves, validateMove, applyMove, outcome } from "./moves.js";
import { buildPlayerView } from "./view.js";
import type { CoupMove, CoupState } from "./types.js";

const P1 = PlayerId("p1");
const P2 = PlayerId("p2");
const P3 = PlayerId("p3");

const seats2 = [
  { playerId: P1, seatIndex: 0 },
  { playerId: P2, seatIndex: 1 },
];

const seats3 = [
  { playerId: P1, seatIndex: 0 },
  { playerId: P2, seatIndex: 1 },
  { playerId: P3, seatIndex: 2 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Force a player's hand to specific cards by manipulating the state directly.
 */
function forceHand(
  state: CoupState,
  playerId: typeof P1,
  cards: [import("./types.js").CoupCard, import("./types.js").CoupCard],
): CoupState {
  return {
    ...state,
    players: state.players.map((p) =>
      p.playerId === playerId
        ? {
            ...p,
            influence: [
              { card: cards[0], revealed: false },
              { card: cards[1], revealed: false },
            ],
          }
        : p,
    ),
  };
}

function forceCoins(state: CoupState, playerId: typeof P1, coins: number): CoupState {
  return {
    ...state,
    players: state.players.map((p) =>
      p.playerId === playerId ? { ...p, coins } : p,
    ),
  };
}

// ─── Deck & Initial State ─────────────────────────────────────────────────────

describe("initialState", () => {
  it("creates a valid 2-player state", () => {
    const s = initialState(seats2);
    expect(s.players).toHaveLength(2);
    expect(s.phase).toBe("ACTION");
    expect(s.deck).toHaveLength(15 - 4); // 15 cards - 2 per player
    expect(s.pendingAction).toBeNull();
  });

  it("each player starts with 2 coins", () => {
    const s = initialState(seats2);
    for (const p of s.players) {
      expect(p.coins).toBe(2);
    }
  });

  it("each player starts with 2 influence", () => {
    const s = initialState(seats2);
    for (const p of s.players) {
      expect(p.influence).toHaveLength(2);
      expect(p.influence.every((i) => !i.revealed)).toBe(true);
    }
  });

  it("requires 2-6 players", () => {
    expect(() => initialState([])).toThrow();
    expect(() => initialState([seats2[0]!])).toThrow();
  });
});

// ─── Income ───────────────────────────────────────────────────────────────────

describe("Income", () => {
  it("gains 1 coin and advances turn", () => {
    const s0 = initialState(seats2);
    const actor = currentActor(s0);
    const move: CoupMove = { kind: "ACTION", action: "Income" };

    const v = validateMove(s0, move, actor);
    expect(v.ok).toBe(true);

    const s1 = applyMove(s0, move, actor);
    expect(s1.phase).toBe("ACTION");
    const actorPlayer = getPlayer(s1, actor);
    expect(actorPlayer?.coins).toBe(3); // started with 2
    // Turn advanced
    expect(currentActor(s1)).not.toBe(actor);
  });

  it("non-active player cannot take Income", () => {
    const s0 = initialState(seats2);
    const actor = currentActor(s0);
    const other = actor === P1 ? P2 : P1;
    const move: CoupMove = { kind: "ACTION", action: "Income" };
    const v = validateMove(s0, move, other);
    expect(v.ok).toBe(false);
  });
});

// ─── Foreign Aid ──────────────────────────────────────────────────────────────

describe("ForeignAid", () => {
  it("enters AWAIT_CHALLENGE_BLOCK phase", () => {
    const s0 = initialState(seats2);
    const actor = currentActor(s0);
    const move: CoupMove = { kind: "ACTION", action: "ForeignAid" };
    const s1 = applyMove(s0, move, actor);
    expect(s1.phase).toBe("AWAIT_CHALLENGE_BLOCK");
    expect(s1.pendingAction?.action).toBe("ForeignAid");
  });

  it("gains 2 coins when opponent passes", () => {
    let s = initialState(seats2);
    const actor = currentActor(s);
    const other = actor === P1 ? P2 : P1;

    s = applyMove(s, { kind: "ACTION", action: "ForeignAid" }, actor);
    expect(s.phase).toBe("AWAIT_CHALLENGE_BLOCK");

    s = applyMove(s, { kind: "PASS" }, other);
    expect(s.phase).toBe("ACTION");

    const actorPlayer = getPlayer(s, actor);
    expect(actorPlayer?.coins).toBe(4); // 2 + 2
  });

  it("can be blocked by Duke", () => {
    let s = initialState(seats2);
    const actor = currentActor(s);
    const blocker = actor === P1 ? P2 : P1;

    s = applyMove(s, { kind: "ACTION", action: "ForeignAid" }, actor);
    s = applyMove(s, { kind: "BLOCK", claimedCard: "Duke" }, blocker);
    expect(s.phase).toBe("AWAIT_BLOCK_CHALLENGE");
    expect(s.pendingAction?.blocker).toBe(blocker);
  });

  it("is cancelled when actor passes on block", () => {
    let s = initialState(seats2);
    const actor = currentActor(s);
    const blocker = actor === P1 ? P2 : P1;

    s = applyMove(s, { kind: "ACTION", action: "ForeignAid" }, actor);
    s = applyMove(s, { kind: "BLOCK", claimedCard: "Duke" }, blocker);
    s = applyMove(s, { kind: "PASS" }, actor);

    expect(s.phase).toBe("ACTION");
    // Actor did not gain coins
    const actorPlayer = getPlayer(s, actor);
    expect(actorPlayer?.coins).toBe(2);
  });
});

// ─── Tax ──────────────────────────────────────────────────────────────────────

describe("Tax (Duke)", () => {
  it("gains 3 coins when unchallenged (2-player)", () => {
    let s = initialState(seats2);
    const actor = currentActor(s);
    const other = actor === P1 ? P2 : P1;

    s = applyMove(s, { kind: "ACTION", action: "Tax" }, actor);
    s = applyMove(s, { kind: "PASS" }, other);

    const actorPlayer = getPlayer(s, actor);
    expect(actorPlayer?.coins).toBe(5); // 2 + 3
  });
});

// ─── Coup ─────────────────────────────────────────────────────────────────────

describe("Coup", () => {
  it("costs 7 coins and asks target to reveal", () => {
    let s = initialState(seats2);
    const actor = currentActor(s);
    const target = actor === P1 ? P2 : P1;

    s = forceCoins(s, actor, 7);
    const move: CoupMove = { kind: "ACTION", action: "Coup", target };
    s = applyMove(s, move, actor);

    expect(s.phase).toBe("AWAIT_REVEAL");
    const actorPlayer = getPlayer(s, actor);
    expect(actorPlayer?.coins).toBe(0); // 7 - 7
  });

  it("target reveals and loses influence", () => {
    let s = initialState(seats2);
    const actor = currentActor(s);
    const target = actor === P1 ? P2 : P1;

    s = forceCoins(s, actor, 7);
    s = applyMove(s, { kind: "ACTION", action: "Coup", target }, actor);
    s = applyMove(s, { kind: "REVEAL", cardIndex: 0 }, target);

    const targetPlayer = getPlayer(s, target);
    expect(targetPlayer?.influence[0]?.revealed).toBe(true);
    expect(influenceCount(targetPlayer!)).toBe(1);
    expect(s.phase).toBe("ACTION");
  });

  it("player is eliminated when both influence revealed", () => {
    let s = initialState(seats2);
    const actor = currentActor(s);
    const target = actor === P1 ? P2 : P1;

    // Reveal one influence manually
    s = {
      ...s,
      players: s.players.map((p) =>
        p.playerId === target
          ? { ...p, influence: [{ card: p.influence[0]!.card, revealed: true }, p.influence[1]!] }
          : p,
      ),
    };

    s = forceCoins(s, actor, 7);
    s = applyMove(s, { kind: "ACTION", action: "Coup", target }, actor);
    s = applyMove(s, { kind: "REVEAL", cardIndex: 1 }, target);

    const targetPlayer = getPlayer(s, target);
    expect(influenceCount(targetPlayer!)).toBe(0);

    const result = outcome(s);
    expect(result?.winner).toBe(actor);
  });

  it("must coup at 10 coins", () => {
    let s = initialState(seats2);
    const actor = currentActor(s);
    s = forceCoins(s, actor, 10);

    const moves = legalMoves(s, actor);
    expect(moves.every((m) => m.kind === "ACTION" && m.action === "Coup")).toBe(true);
  });
});

// ─── Steal ────────────────────────────────────────────────────────────────────

describe("Steal (Captain)", () => {
  it("takes 2 coins from target when unchallenged", () => {
    let s = initialState(seats2);
    const actor = currentActor(s);
    const target = actor === P1 ? P2 : P1;

    s = applyMove(s, { kind: "ACTION", action: "Steal", target }, actor);
    // other passes
    s = applyMove(s, { kind: "PASS" }, target);

    const actorPlayer = getPlayer(s, actor);
    const targetPlayer = getPlayer(s, target);
    expect(actorPlayer?.coins).toBe(4); // 2 + 2
    expect(targetPlayer?.coins).toBe(0); // 2 - 2
  });

  it("takes only available coins from poor target", () => {
    let s = initialState(seats2);
    const actor = currentActor(s);
    const target = actor === P1 ? P2 : P1;

    s = forceCoins(s, target, 1);
    s = applyMove(s, { kind: "ACTION", action: "Steal", target }, actor);
    s = applyMove(s, { kind: "PASS" }, target);

    const actorPlayer = getPlayer(s, actor);
    const targetPlayer = getPlayer(s, target);
    expect(actorPlayer?.coins).toBe(3); // 2 + 1
    expect(targetPlayer?.coins).toBe(0);
  });
});

// ─── Assassinate ──────────────────────────────────────────────────────────────

describe("Assassinate", () => {
  it("requires 3 coins and asks target to reveal when unchallenged/unblocked", () => {
    let s = initialState(seats2);
    const actor = currentActor(s);
    const target = actor === P1 ? P2 : P1;

    s = forceCoins(s, actor, 3);
    s = applyMove(s, { kind: "ACTION", action: "Assassinate", target }, actor);
    // Target passes challenge/block
    s = applyMove(s, { kind: "PASS" }, target);

    expect(s.phase).toBe("AWAIT_REVEAL");
    const actorPlayer = getPlayer(s, actor);
    expect(actorPlayer?.coins).toBe(0); // 3 - 3
  });
});

// ─── Challenge (bluff): Tax ───────────────────────────────────────────────────

describe("Challenges", () => {
  it("successful challenge (actor bluffing): actor loses influence", () => {
    let s = initialState(seats2);
    const actor = currentActor(s);
    const other = actor === P1 ? P2 : P1;

    // Force actor NOT to have Duke
    s = forceHand(s, actor as typeof P1, ["Contessa", "Contessa"]);

    s = applyMove(s, { kind: "ACTION", action: "Tax" }, actor);
    // Other challenges
    s = applyMove(s, { kind: "CHALLENGE" }, other);

    // Actor must reveal
    expect(s.phase).toBe("AWAIT_REVEAL");
    expect(s.pendingAction?.target).toBe(actor);
  });

  it("failed challenge (actor has card): challenger loses influence", () => {
    let s = initialState(seats2);
    const actor = currentActor(s);
    const other = actor === P1 ? P2 : P1;

    // Force actor to have Duke
    s = forceHand(s, actor as typeof P1, ["Duke", "Contessa"]);

    s = applyMove(s, { kind: "ACTION", action: "Tax" }, actor);
    s = applyMove(s, { kind: "CHALLENGE" }, other);

    // Challenger must reveal (challenger failed)
    expect(s.phase).toBe("AWAIT_REVEAL");
    expect(s.pendingAction?.target).toBe(other);
  });
});

// ─── View masking ─────────────────────────────────────────────────────────────

describe("buildPlayerView", () => {
  it("masks opponents' hidden cards", () => {
    const s = initialState(seats2);
    const view = buildPlayerView(s, P1);

    for (const pv of view.players) {
      if (pv.playerId === P1) {
        // Own cards visible
        for (const inf of pv.influence) {
          expect(inf.card).not.toBe("?");
        }
      } else {
        // Opponent's hidden cards masked
        for (const inf of pv.influence) {
          if (!inf.revealed) {
            expect(inf.card).toBe("?");
          }
        }
      }
    }
  });

  it("exposes deck size only", () => {
    const s = initialState(seats2);
    const view = buildPlayerView(s, P1);
    expect(view.deckSize).toBe(s.deck.length);
    expect((view as unknown as Record<string, unknown>)["deck"]).toBeUndefined();
  });
});

// ─── Exchange ─────────────────────────────────────────────────────────────────

describe("Exchange (Ambassador)", () => {
  it("enters AWAIT_EXCHANGE after passing challenge", () => {
    let s = initialState(seats2);
    const actor = currentActor(s);
    const other = actor === P1 ? P2 : P1;

    s = applyMove(s, { kind: "ACTION", action: "Exchange" }, actor);
    s = applyMove(s, { kind: "PASS" }, other);

    expect(s.phase).toBe("AWAIT_EXCHANGE");
    // Actor has 4 influence slots (2 original + 2 drawn)
    const actorPlayer = getPlayer(s, actor);
    expect(actorPlayer?.influence.filter((i) => !i.revealed)).toHaveLength(4);
  });

  it("player returns 2 cards and keeps 2", () => {
    let s = initialState(seats2);
    const actor = currentActor(s);
    const other = actor === P1 ? P2 : P1;

    s = applyMove(s, { kind: "ACTION", action: "Exchange" }, actor);
    s = applyMove(s, { kind: "PASS" }, other);

    const moves = legalMoves(s, actor);
    const exchangeMove = moves.find((m) => m.kind === "EXCHANGE_RETURN");
    expect(exchangeMove).toBeDefined();

    s = applyMove(s, exchangeMove!, actor);

    const actorPlayer = getPlayer(s, actor);
    expect(actorPlayer?.influence.filter((i) => !i.revealed)).toHaveLength(2);
    expect(s.phase).toBe("ACTION");
  });
});

// ─── Multi-player responses ───────────────────────────────────────────────────

describe("Multi-player ForeignAid (3 players)", () => {
  it("resolves only after all non-actors have passed", () => {
    let s = initialState(seats3);
    const actor = currentActor(s);
    const others = [P1, P2, P3].filter((p) => p !== actor);

    s = applyMove(s, { kind: "ACTION", action: "ForeignAid" }, actor);
    expect(s.phase).toBe("AWAIT_CHALLENGE_BLOCK");

    // First other passes
    s = applyMove(s, { kind: "PASS" }, others[0]!);
    expect(s.phase).toBe("AWAIT_CHALLENGE_BLOCK"); // still waiting

    // Second other passes
    s = applyMove(s, { kind: "PASS" }, others[1]!);
    expect(s.phase).toBe("ACTION"); // now resolved

    const actorPlayer = getPlayer(s, actor);
    expect(actorPlayer?.coins).toBe(4);
  });
});

// ─── Outcome ──────────────────────────────────────────────────────────────────

describe("outcome", () => {
  it("returns null when multiple players alive", () => {
    const s = initialState(seats2);
    expect(outcome(s)).toBeNull();
  });

  it("returns winner when one player remains", () => {
    let s = initialState(seats2);
    const actor = currentActor(s);
    const target = actor === P1 ? P2 : P1;

    // Eliminate target completely
    s = {
      ...s,
      players: s.players.map((p) =>
        p.playerId === target
          ? {
              ...p,
              influence: p.influence.map((inf) => ({ ...inf, revealed: true })),
            }
          : p,
      ),
    };

    const result = outcome(s);
    expect(result?.winner).toBe(actor);
  });
});
