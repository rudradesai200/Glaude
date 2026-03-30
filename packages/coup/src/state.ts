import type { PlayerId, PlayerSeat } from "@glaude/shared";
import { CARDS_PER_HAND, createDeck, deal, shuffle } from "./deck.js";
import type { CoupPlayer, CoupState } from "./types.js";

/** Starting coins per player */
export const STARTING_COINS = 2;
/** Coup cost */
export const COUP_COST = 7;
/** At or above this coin count, the player MUST coup */
export const MUST_COUP_AT = 10;

// ─── Initialization ───────────────────────────────────────────────────────────

export function initialState(seats: readonly PlayerSeat[]): CoupState {
  if (seats.length < 2 || seats.length > 6) {
    throw new Error(`Coup requires 2–6 players, got ${seats.length}`);
  }

  let deck = shuffle(createDeck());
  const players: CoupPlayer[] = [];

  for (const seat of seats) {
    const { dealt, remaining } = deal(deck, CARDS_PER_HAND);
    deck = remaining;
    players.push({
      playerId: seat.playerId,
      coins: STARTING_COINS,
      influence: dealt.map((card) => ({ card, revealed: false })),
    });
  }

  const turnOrder = seats.map((s) => s.playerId);

  return {
    players,
    turnOrder,
    turnIndex: 0,
    phase: "ACTION",
    deck,
    pendingAction: null,
    responded: [],
  };
}

// ─── Player helpers ───────────────────────────────────────────────────────────

export function getPlayer(state: CoupState, playerId: PlayerId): CoupPlayer | undefined {
  return state.players.find((p) => p.playerId === playerId);
}

/** Live influence count (unrevealed cards) */
export function influenceCount(player: CoupPlayer): number {
  return player.influence.filter((i) => !i.revealed).length;
}

export function isEliminated(player: CoupPlayer): boolean {
  return influenceCount(player) === 0;
}

/** Players still in the game */
export function activePlayers(state: CoupState): CoupPlayer[] {
  return state.players.filter((p) => !isEliminated(p));
}

export function activePlayerIds(state: CoupState): PlayerId[] {
  return activePlayers(state).map((p) => p.playerId);
}

/** Current acting player */
export function currentActor(state: CoupState): PlayerId {
  const id = state.turnOrder[state.turnIndex];
  if (id === undefined) throw new Error("Invalid turn index");
  return id;
}

// ─── Turn advancement ─────────────────────────────────────────────────────────

/** Advance to the next non-eliminated player */
export function nextTurnIndex(state: CoupState): number {
  const len = state.turnOrder.length;
  let idx = (state.turnIndex + 1) % len;
  for (let i = 0; i < len; i++) {
    const pid = state.turnOrder[idx];
    if (pid === undefined) break;
    const player = getPlayer(state, pid);
    if (player && !isEliminated(player)) return idx;
    idx = (idx + 1) % len;
  }
  return idx; // fallback (single player left)
}

// ─── Coin mutations ───────────────────────────────────────────────────────────

export function updateCoins(
  state: CoupState,
  playerId: PlayerId,
  delta: number,
): CoupState {
  return {
    ...state,
    players: state.players.map((p) =>
      p.playerId === playerId ? { ...p, coins: p.coins + delta } : p,
    ),
  };
}

// ─── Reveal influence ─────────────────────────────────────────────────────────

/**
 * Reveal (lose) one specific influence card by index.
 * The card slot is marked `revealed: true` but remains in the array
 * so players can see what was lost.
 */
export function revealInfluence(
  state: CoupState,
  playerId: PlayerId,
  cardIndex: number,
): CoupState {
  return {
    ...state,
    players: state.players.map((p) => {
      if (p.playerId !== playerId) return p;
      const influence = p.influence.map((inf, i) =>
        i === cardIndex ? { ...inf, revealed: true } : inf,
      );
      return { ...p, influence };
    }),
  };
}

/**
 * Lose one hidden influence (picks the first unrevealed card).
 * Used when the exact card doesn't matter (e.g. Coup target).
 */
export function loseInfluence(
  state: CoupState,
  playerId: PlayerId,
  cardIndex: number,
): CoupState {
  return revealInfluence(state, playerId, cardIndex);
}

// ─── Replace card after failed challenge (reshuffle) ─────────────────────────

/**
 * Replace the card at `cardIndex` with a new card drawn from the deck.
 * The old card is returned to the deck and reshuffled.
 */
export function replaceCard(
  state: CoupState,
  playerId: PlayerId,
  cardIndex: number,
): CoupState {
  const player = getPlayer(state, playerId);
  if (!player) return state;

  const oldCard = player.influence[cardIndex]?.card;
  if (oldCard === undefined) return state;

  // Return old card and reshuffle
  const deckWithOld = shuffle([...state.deck, oldCard]);
  const newCard = deckWithOld[0];
  if (newCard === undefined) return state;
  const newDeck = deckWithOld.slice(1);

  return {
    ...state,
    deck: newDeck,
    players: state.players.map((p) => {
      if (p.playerId !== playerId) return p;
      const influence = p.influence.map((inf, i) =>
        i === cardIndex ? { card: newCard, revealed: false } : inf,
      );
      return { ...p, influence };
    }),
  };
}

// ─── Reset to ACTION phase ────────────────────────────────────────────────────

export function resetToAction(state: CoupState, nextIndex: number): CoupState {
  return {
    ...state,
    phase: "ACTION",
    pendingAction: null,
    responded: [],
    turnIndex: nextIndex,
  };
}
