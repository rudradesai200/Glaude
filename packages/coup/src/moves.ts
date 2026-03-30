import type { PlayerId } from "@glaude/shared";
import { err, ok } from "@glaude/shared";
import type { Result } from "@glaude/shared";
import { returnAndShuffle, shuffle } from "./deck.js";
import {
  activePlayerIds,
  activePlayers,
  COUP_COST,
  currentActor,
  getPlayer,
  influenceCount,
  isEliminated,
  loseInfluence,
  MUST_COUP_AT,
  nextTurnIndex,
  replaceCard,
  resetToAction,
  updateCoins,
} from "./state.js";
import type {
  CoupActionType,
  CoupCard,
  CoupMove,
  CoupPlayer,
  CoupState,
  PendingAction,
} from "./types.js";

// ─── Card → Action mapping ────────────────────────────────────────────────────

/** Which card each action requires (undefined = no card needed) */
const ACTION_CARD: Partial<Record<CoupActionType, CoupCard>> = {
  Tax: "Duke",
  Assassinate: "Assassin",
  Steal: "Captain",
  Exchange: "Ambassador",
};

/** Which cards can block each action (empty = unblockable) */
const BLOCKING_CARDS: Partial<Record<CoupActionType, readonly CoupCard[]>> = {
  ForeignAid: ["Duke"],
  Assassinate: ["Contessa"],
  Steal: ["Captain", "Ambassador"],
};

// ─── Legal Moves ──────────────────────────────────────────────────────────────

export function legalMoves(state: CoupState, playerId: PlayerId): readonly CoupMove[] {
  const player = getPlayer(state, playerId);
  if (!player || isEliminated(player)) return [];

  switch (state.phase) {
    case "ACTION":
      return legalActionMoves(state, player);
    case "AWAIT_CHALLENGE_BLOCK":
      return legalChallengeBlockMoves(state, playerId);
    case "AWAIT_BLOCK_CHALLENGE":
      return legalBlockChallengeMoves(state, playerId);
    case "AWAIT_REVEAL":
      return legalRevealMoves(state, playerId, player);
    case "AWAIT_EXCHANGE":
      return legalExchangeMoves(state, playerId, player);
    default:
      return [];
  }
}

function legalActionMoves(state: CoupState, player: CoupPlayer): CoupMove[] {
  if (player.playerId !== currentActor(state)) return [];

  const moves: CoupMove[] = [];
  const coins = player.coins;

  // Must coup at MUST_COUP_AT or more
  if (coins >= MUST_COUP_AT) {
    const targets = activePlayers(state).filter((p) => p.playerId !== player.playerId);
    return targets.map((t) => ({
      kind: "ACTION",
      action: "Coup" as CoupActionType,
      target: t.playerId,
    }));
  }

  // Income — always available
  moves.push({ kind: "ACTION", action: "Income" });

  // Foreign Aid
  moves.push({ kind: "ACTION", action: "ForeignAid" });

  // Coup (if enough coins)
  if (coins >= COUP_COST) {
    const targets = activePlayers(state).filter((p) => p.playerId !== player.playerId);
    for (const t of targets) {
      moves.push({ kind: "ACTION", action: "Coup", target: t.playerId });
    }
  }

  // Tax (Duke)
  moves.push({ kind: "ACTION", action: "Tax" });

  // Assassinate (Assassin) — costs 3
  if (coins >= 3) {
    const targets = activePlayers(state).filter((p) => p.playerId !== player.playerId);
    for (const t of targets) {
      moves.push({ kind: "ACTION", action: "Assassinate", target: t.playerId });
    }
  }

  // Steal (Captain)
  const stealTargets = activePlayers(state).filter(
    (p) => p.playerId !== player.playerId && p.coins > 0,
  );
  for (const t of stealTargets) {
    moves.push({ kind: "ACTION", action: "Steal", target: t.playerId });
  }

  // Exchange (Ambassador)
  moves.push({ kind: "ACTION", action: "Exchange" });

  return moves;
}

function legalChallengeBlockMoves(state: CoupState, playerId: PlayerId): CoupMove[] {
  // If already responded, no moves
  if (state.responded.includes(playerId)) return [];

  const pending = state.pendingAction;
  if (!pending) return [];

  // Actor doesn't respond in this phase
  if (playerId === pending.actor) return [];

  const moves: CoupMove[] = [{ kind: "PASS" }];

  // Can challenge if the action claims a card
  if (pending.claimedCard) {
    moves.push({ kind: "CHALLENGE" });
  }

  // Can block if this player is the target or action is blockable by anyone
  const blockingCards = BLOCKING_CARDS[pending.action];
  if (blockingCards && blockingCards.length > 0) {
    const isTarget = pending.target === playerId;
    const isAnyoneBlock =
      pending.action === "ForeignAid"; // ForeignAid: any Duke holder can block

    if (isTarget || isAnyoneBlock) {
      for (const card of blockingCards) {
        moves.push({ kind: "BLOCK", claimedCard: card });
      }
    }
  }

  return moves;
}

function legalBlockChallengeMoves(state: CoupState, playerId: PlayerId): CoupMove[] {
  const pending = state.pendingAction;
  if (!pending) return [];

  // Only the actor responds to the block
  if (playerId !== pending.actor) return [];
  if (state.responded.includes(playerId)) return [];

  return [{ kind: "PASS" }, { kind: "CHALLENGE" }];
}

function legalRevealMoves(
  state: CoupState,
  playerId: PlayerId,
  player: CoupPlayer,
): CoupMove[] {
  // Only the player being asked to reveal can act
  // The pending action determines who must reveal
  const pending = state.pendingAction;
  if (!pending) return [];

  const mustReveal = whoMustReveal(state);
  if (mustReveal !== playerId) return [];

  return player.influence
    .map((inf, i) => ({ inf, i }))
    .filter(({ inf }) => !inf.revealed)
    .map(({ i }) => ({ kind: "REVEAL" as const, cardIndex: i }));
}

function legalExchangeMoves(
  state: CoupState,
  playerId: PlayerId,
  player: CoupPlayer,
): CoupMove[] {
  const pending = state.pendingAction;
  if (!pending || pending.actor !== playerId) return [];

  // Player has their current unrevealed cards + 2 drawn cards
  // The drawn cards are appended to influence array as unrevealed (temporary)
  const unrevealed = player.influence
    .map((inf, i) => ({ inf, i }))
    .filter(({ inf }) => !inf.revealed);

  if (unrevealed.length < 2) return [];

  // Generate all combinations of 2 indices to keep
  const moves: CoupMove[] = [];
  for (let a = 0; a < unrevealed.length; a++) {
    for (let b = a + 1; b < unrevealed.length; b++) {
      const ia = unrevealed[a]?.i;
      const ib = unrevealed[b]?.i;
      if (ia !== undefined && ib !== undefined) {
        moves.push({ kind: "EXCHANGE_RETURN", keepIndices: [ia, ib] });
      }
    }
  }

  return moves;
}

// ─── Validate Move ────────────────────────────────────────────────────────────

export function validateMove(
  state: CoupState,
  move: CoupMove,
  playerId: PlayerId,
): Result<void, string> {
  const player = getPlayer(state, playerId);
  if (!player) return err("Player not found");
  if (isEliminated(player)) return err("You are eliminated");

  const legal = legalMoves(state, playerId);
  const isLegal = legal.some((m) => movesEqual(m, move));
  if (!isLegal) return err(`Move ${JSON.stringify(move)} is not legal`);

  return ok(undefined);
}

function movesEqual(a: CoupMove, b: CoupMove): boolean {
  if (a.kind !== b.kind) return false;
  switch (a.kind) {
    case "ACTION": {
      const bb = b as Extract<CoupMove, { kind: "ACTION" }>;
      return a.action === bb.action && a.target === bb.target;
    }
    case "BLOCK": {
      const bb = b as Extract<CoupMove, { kind: "BLOCK" }>;
      return a.claimedCard === bb.claimedCard;
    }
    case "REVEAL": {
      const bb = b as Extract<CoupMove, { kind: "REVEAL" }>;
      return a.cardIndex === bb.cardIndex;
    }
    case "EXCHANGE_RETURN": {
      const bb = b as Extract<CoupMove, { kind: "EXCHANGE_RETURN" }>;
      return a.keepIndices[0] === bb.keepIndices[0] && a.keepIndices[1] === bb.keepIndices[1];
    }
    case "PASS":
    case "CHALLENGE":
      return true;
    default:
      return false;
  }
}

// ─── Apply Move ───────────────────────────────────────────────────────────────

export function applyMove(state: CoupState, move: CoupMove, playerId: PlayerId): CoupState {
  switch (state.phase) {
    case "ACTION":
      return applyAction(state, move, playerId);
    case "AWAIT_CHALLENGE_BLOCK":
      return applyChallengeBlock(state, move, playerId);
    case "AWAIT_BLOCK_CHALLENGE":
      return applyBlockChallenge(state, move, playerId);
    case "AWAIT_REVEAL":
      return applyReveal(state, move, playerId);
    case "AWAIT_EXCHANGE":
      return applyExchange(state, move, playerId);
    default:
      return state;
  }
}

// ─── Phase: ACTION ────────────────────────────────────────────────────────────

function applyAction(state: CoupState, move: CoupMove, playerId: PlayerId): CoupState {
  if (move.kind !== "ACTION") return state;

  const { action, target } = move;
  const claimedCard = ACTION_CARD[action];

  // Build pending action
  const pending: PendingAction = {
    actor: playerId,
    action,
    ...(target !== undefined ? { target } : {}),
    ...(claimedCard !== undefined ? { claimedCard } : {}),
  };

  // Unblockable, unchallenged actions resolve immediately
  if (action === "Income") {
    let s = { ...state, pendingAction: pending };
    s = updateCoins(s, playerId, 1);
    return resetToAction(s, nextTurnIndex(s));
  }

  if (action === "Coup") {
    if (!target) return state;
    // Deduct coins, then ask target to reveal
    let s = updateCoins(state, playerId, -COUP_COST);
    s = { ...s, pendingAction: pending, phase: "AWAIT_REVEAL", responded: [] };
    return s;
  }

  // All other actions: enter challenge/block phase
  return {
    ...state,
    pendingAction: pending,
    phase: "AWAIT_CHALLENGE_BLOCK",
    responded: [],
  };
}

// ─── Phase: AWAIT_CHALLENGE_BLOCK ─────────────────────────────────────────────

function applyChallengeBlock(
  state: CoupState,
  move: CoupMove,
  playerId: PlayerId,
): CoupState {
  const pending = state.pendingAction;
  if (!pending) return state;

  if (move.kind === "CHALLENGE") {
    // Someone challenges the actor's claimed card
    // pending.claimedCard must exist (enforced by legalMoves)
    return resolveChallenge(state, playerId, pending.actor, pending.claimedCard!, "actor");
  }

  if (move.kind === "BLOCK") {
    // Someone blocks — enter AWAIT_BLOCK_CHALLENGE for actor to respond
    const newPending: PendingAction = {
      ...pending,
      blocker: playerId,
      blockedCard: move.claimedCard,
    };
    return {
      ...state,
      pendingAction: newPending,
      phase: "AWAIT_BLOCK_CHALLENGE",
      responded: [],
    };
  }

  // PASS — mark this player as responded
  const responded = [...state.responded, playerId];
  const s2 = { ...state, responded };

  // Check if all non-actor active players have responded
  const active = activePlayerIds(s2).filter((id) => id !== pending.actor);
  const allResponded = active.every((id) => responded.includes(id));

  if (allResponded) {
    // No challenges or blocks — resolve the action
    return resolveAction(s2);
  }

  return s2;
}

// ─── Phase: AWAIT_BLOCK_CHALLENGE ─────────────────────────────────────────────

function applyBlockChallenge(
  state: CoupState,
  move: CoupMove,
  playerId: PlayerId,
): CoupState {
  const pending = state.pendingAction;
  if (!pending || !pending.blocker || !pending.blockedCard) return state;

  if (move.kind === "CHALLENGE") {
    // Actor challenges the block
    return resolveChallenge(
      state,
      playerId,
      pending.blocker,
      pending.blockedCard,
      "blocker",
    );
  }

  // PASS — actor accepts the block; action is cancelled
  const nextIdx = nextTurnIndex(state);
  return resetToAction(state, nextIdx);
}

// ─── Phase: AWAIT_REVEAL ──────────────────────────────────────────────────────

function applyReveal(state: CoupState, move: CoupMove, playerId: PlayerId): CoupState {
  if (move.kind !== "REVEAL") return state;
  const pending = state.pendingAction;
  if (!pending) return state;

  const mustReveal = whoMustReveal(state);
  if (mustReveal !== playerId) return state;

  // Reveal the card
  let s = loseInfluence(state, playerId, move.cardIndex);

  // Determine what comes next based on why we're revealing
  const nextIdx = nextTurnIndex(s);

  // Was this a Coup or Assassinate target reveal?
  if (pending.action === "Coup" || pending.action === "Assassinate") {
    // Target lost influence; now check if Exchange needs to happen
    // If it was Assassinate, the action is done
    return resetToAction(s, nextIdx);
  }

  // Was this a failed challenge (challenger revealing)?
  // The action was challenged and challenger lost — continue resolving action
  if (s.phase === "AWAIT_REVEAL") {
    return resolveAction({ ...s, phase: "AWAIT_REVEAL" });
  }

  return resetToAction(s, nextIdx);
}

// ─── Phase: AWAIT_EXCHANGE ────────────────────────────────────────────────────

function applyExchange(state: CoupState, move: CoupMove, playerId: PlayerId): CoupState {
  if (move.kind !== "EXCHANGE_RETURN") return state;
  const pending = state.pendingAction;
  if (!pending) return state;

  const player = getPlayer(state, playerId);
  if (!player) return state;

  // Player's current influence array has: original cards + 2 drawn at top
  // keepIndices are the 2 cards to keep; discard the rest
  const keepSet = new Set(move.keepIndices);
  const keptInfluence = player.influence.filter((_, i) => keepSet.has(i));
  const returnedCards = player.influence
    .filter((inf, i) => !keepSet.has(i) && !inf.revealed)
    .map((inf) => inf.card);

  // Return discarded cards to deck
  let newDeck = state.deck as CoupCard[];
  for (const card of returnedCards) {
    newDeck = returnAndShuffle(newDeck, card);
  }

  const s2: CoupState = {
    ...state,
    deck: newDeck,
    players: state.players.map((p) =>
      p.playerId === playerId ? { ...p, influence: keptInfluence } : p,
    ),
  };

  return resetToAction(s2, nextTurnIndex(s2));
}

// ─── Challenge Resolution ─────────────────────────────────────────────────────

/**
 * Resolve a challenge.
 *
 * @param challenger - the player who issued the challenge
 * @param claimant   - the player whose claim is being challenged
 * @param claimedCard - the card the claimant said they have
 * @param claimantRole - "actor" (challenged the original action) | "blocker"
 */
function resolveChallenge(
  state: CoupState,
  challenger: PlayerId,
  claimant: PlayerId,
  claimedCard: CoupCard,
  claimantRole: "actor" | "blocker",
): CoupState {
  const claimantPlayer = getPlayer(state, claimant);
  if (!claimantPlayer) return state;

  // Does the claimant actually have the claimed card?
  const cardIdx = claimantPlayer.influence.findIndex(
    (inf) => inf.card === claimedCard && !inf.revealed,
  );

  if (cardIdx !== -1) {
    // Claimant had the card — challenger loses 1 influence
    // Claimant replaces their proven card
    let s = replaceCard(state, claimant, cardIdx);

    // Challenger must reveal — transition to AWAIT_REVEAL
    // We encode who must reveal in pendingAction context
    const pending = s.pendingAction;
    const newPending: PendingAction = {
      ...(pending ?? { actor: claimant, action: "Tax" }),
      // Encode that challenger is next to reveal
      target: challenger,
    };

    if (claimantRole === "actor") {
      // Challenger failed; action proceeds after challenger reveals
      return {
        ...s,
        pendingAction: { ...newPending, blocker: undefined, blockedCard: undefined },
        phase: "AWAIT_REVEAL",
        responded: [],
      };
    } else {
      // Block was challenged; challenger (actor) failed
      // Block stands — action is cancelled
      // But actor must still reveal
      return {
        ...s,
        pendingAction: newPending,
        phase: "AWAIT_REVEAL",
        responded: [],
      };
    }
  } else {
    // Claimant was bluffing — claimant loses 1 influence
    // Must enter AWAIT_REVEAL for claimant to choose which card to reveal
    const pending = state.pendingAction;
    const newPending: PendingAction = {
      ...(pending ?? { actor: claimant, action: "Tax" }),
      // target encodes who must reveal
      target: claimant,
    };

    return {
      ...state,
      pendingAction: newPending,
      phase: "AWAIT_REVEAL",
      responded: [],
    };
  }
}

// ─── Action Resolution ────────────────────────────────────────────────────────

function resolveAction(state: CoupState): CoupState {
  const pending = state.pendingAction;
  if (!pending) return state;

  const { actor, action, target } = pending;
  let s = state;

  switch (action) {
    case "ForeignAid":
      s = updateCoins(s, actor, 2);
      return resetToAction(s, nextTurnIndex(s));

    case "Tax":
      s = updateCoins(s, actor, 3);
      return resetToAction(s, nextTurnIndex(s));

    case "Assassinate": {
      if (!target) return resetToAction(s, nextTurnIndex(s));
      // Deduct 3 coins from actor (already paid when action was chosen)
      s = updateCoins(s, actor, -3);
      // Ask target to reveal
      return { ...s, phase: "AWAIT_REVEAL", responded: [] };
    }

    case "Steal": {
      if (!target) return resetToAction(s, nextTurnIndex(s));
      const targetPlayer = getPlayer(s, target);
      if (!targetPlayer) return resetToAction(s, nextTurnIndex(s));
      const stolen = Math.min(2, targetPlayer.coins);
      s = updateCoins(s, target, -stolen);
      s = updateCoins(s, actor, stolen);
      return resetToAction(s, nextTurnIndex(s));
    }

    case "Exchange": {
      // Draw 2 cards for ambassador exchange
      const { dealt, remaining } = require_deal(s.deck, 2);
      const actorPlayer = getPlayer(s, actor);
      if (!actorPlayer) return resetToAction(s, nextTurnIndex(s));

      // Add drawn cards to actor's hand temporarily
      const newInfluence = [
        ...actorPlayer.influence,
        ...dealt.map((card) => ({ card, revealed: false as const })),
      ];
      s = {
        ...s,
        deck: remaining,
        players: s.players.map((p) =>
          p.playerId === actor ? { ...p, influence: newInfluence } : p,
        ),
        phase: "AWAIT_EXCHANGE",
        responded: [],
      };
      return s;
    }

    default:
      return resetToAction(s, nextTurnIndex(s));
  }
}

/** Inline deal helper to avoid circular import */
function require_deal(
  deck: readonly CoupCard[],
  count: number,
): { dealt: CoupCard[]; remaining: CoupCard[] } {
  const dealt = deck.slice(0, count) as CoupCard[];
  const remaining = deck.slice(count) as CoupCard[];
  return { dealt, remaining };
}

// ─── Who must reveal ──────────────────────────────────────────────────────────

/**
 * Determine which player needs to reveal in AWAIT_REVEAL.
 * We encode this as `pending.target`.
 */
export function whoMustReveal(state: CoupState): PlayerId | undefined {
  return state.pendingAction?.target;
}

// ─── Outcome ──────────────────────────────────────────────────────────────────

export function outcome(state: CoupState): { winner: PlayerId } | null {
  const alive = activePlayers(state);
  if (alive.length === 1) {
    const winner = alive[0];
    if (winner) return { winner: winner.playerId };
  }
  return null;
}
