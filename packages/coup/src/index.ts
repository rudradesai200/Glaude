export type {
  CoupCard,
  CoupActionType,
  CoupPhase,
  Influence,
  PendingAction,
  CoupPlayer,
  CoupState,
  CoupMove,
  CoupRenderContext,
} from "./types.js";

export { createDeck, shuffle, deal, returnAndShuffle, CARDS_PER_ROLE, CARDS_PER_HAND } from "./deck.js";

export {
  initialState,
  getPlayer,
  influenceCount,
  isEliminated,
  activePlayers,
  activePlayerIds,
  currentActor,
  nextTurnIndex,
  updateCoins,
  revealInfluence,
  loseInfluence,
  replaceCard,
  resetToAction,
  STARTING_COINS,
  COUP_COST,
  MUST_COUP_AT,
} from "./state.js";

export { legalMoves, validateMove, applyMove, outcome, whoMustReveal } from "./moves.js";

export { buildPlayerView } from "./view.js";
export type { CoupStateView, PlayerView, HiddenInfluence, VisibleInfluence } from "./view.js";

export { coupDefinition } from "./definition.js";
