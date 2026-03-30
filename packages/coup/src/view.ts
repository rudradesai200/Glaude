import type { PlayerId } from "@glaude/shared";
import type { CoupPlayer, CoupState } from "./types.js";

/**
 * Build a view of the game state masked for a specific observer.
 *
 * Rules:
 * - The observer sees their own cards (revealed or not) in full.
 * - Other players' unrevealed cards are hidden (card set to "?").
 * - Revealed cards are visible to everyone.
 * - Pending action, phase, coins, and turn order are always visible.
 */
export type HiddenInfluence = { readonly card: "?"; readonly revealed: false };
export type VisibleInfluence = { readonly card: string; readonly revealed: boolean };

export type PlayerView = {
  readonly playerId: PlayerId;
  readonly coins: number;
  readonly influence: readonly (HiddenInfluence | VisibleInfluence)[];
};

export type CoupStateView = Omit<CoupState, "players" | "deck"> & {
  readonly players: readonly PlayerView[];
  /** Deck size only — contents hidden */
  readonly deckSize: number;
};

export function buildPlayerView(state: CoupState, observer: PlayerId): CoupStateView {
  const players: PlayerView[] = state.players.map((p) =>
    maskPlayer(p, observer),
  );

  const { deck, players: _players, ...rest } = state;

  return {
    ...rest,
    players,
    deckSize: deck.length,
  };
}

function maskPlayer(player: CoupPlayer, observer: PlayerId): PlayerView {
  const isObserver = player.playerId === observer;

  const influence = player.influence.map((inf) => {
    if (inf.revealed) {
      // Revealed cards are public
      return { card: inf.card, revealed: true as const };
    }
    if (isObserver) {
      // Own hidden card — show it
      return { card: inf.card, revealed: false as const };
    }
    // Other player's hidden card — mask it
    return { card: "?" as const, revealed: false as const };
  });

  return {
    playerId: player.playerId,
    coins: player.coins,
    influence,
  };
}
