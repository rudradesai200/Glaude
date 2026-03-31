import type { PlayerId } from "@glaude/shared";

// ─── Card & Action Enums ──────────────────────────────────────────────────────

export type CoupCard = "Duke" | "Assassin" | "Captain" | "Ambassador" | "Contessa";

export type CoupActionType =
  | "Income"
  | "ForeignAid"
  | "Coup"
  | "Tax"
  | "Assassinate"
  | "Steal"
  | "Exchange";

// ─── Phase ────────────────────────────────────────────────────────────────────

export type CoupPhase =
  | "ACTION"
  | "AWAIT_CHALLENGE_BLOCK"
  | "AWAIT_BLOCK_CHALLENGE"
  | "AWAIT_REVEAL"
  | "AWAIT_EXCHANGE";

// ─── Influence ────────────────────────────────────────────────────────────────

export type Influence = {
  readonly card: CoupCard;
  readonly revealed: boolean;
};

// ─── Pending Action ───────────────────────────────────────────────────────────

/**
 * Carries the declared action and all context needed to resolve it across
 * multiple interaction phases.
 */
export type PendingAction = {
  readonly actor: PlayerId;
  readonly action: CoupActionType;
  readonly target?: PlayerId;
  /** Card the actor claimed to have (for blockable/challenge-able actions) */
  readonly claimedCard?: CoupCard;
  /** Player who blocked, if any */
  readonly blocker?: PlayerId;
  /** Card the blocker claimed */
  readonly blockedCard?: CoupCard;
};

// ─── Player State ─────────────────────────────────────────────────────────────

export type CoupPlayer = {
  readonly playerId: PlayerId;
  readonly coins: number;
  readonly influence: readonly Influence[];
};

// ─── Game State ───────────────────────────────────────────────────────────────

export type CoupState = {
  readonly players: readonly CoupPlayer[];
  /** Full turn order (never shrinks; eliminated players are skipped) */
  readonly turnOrder: readonly PlayerId[];
  /** Index into turnOrder for the current active player */
  readonly turnIndex: number;
  readonly phase: CoupPhase;
  readonly deck: readonly CoupCard[];
  readonly pendingAction: PendingAction | null;
  /**
   * Players who have already responded (passed/acted) in a multi-response
   * phase (AWAIT_CHALLENGE_BLOCK or AWAIT_BLOCK_CHALLENGE).
   */
  readonly responded: readonly PlayerId[];
  readonly moveNumber: number;
};

// ─── Moves ────────────────────────────────────────────────────────────────────

export type CoupMove =
  | { readonly kind: "ACTION"; readonly action: CoupActionType; readonly target?: PlayerId }
  | { readonly kind: "PASS" }
  | { readonly kind: "CHALLENGE" }
  | { readonly kind: "BLOCK"; readonly claimedCard: CoupCard }
  | { readonly kind: "REVEAL"; readonly cardIndex: number }
  | { readonly kind: "EXCHANGE_RETURN"; readonly keepIndices: readonly [number, number] };

// ─── Render Context (stub for Phase 1) ───────────────────────────────────────

export type CoupRenderContext = {
  readonly state: CoupState;
  readonly seats: readonly { readonly playerId: PlayerId; readonly seatIndex: number }[];
};
