import type { CoupCard } from "./types.js";

/** Standard Coup deck: 3 copies of each of 5 roles = 15 cards */
const CARDS: readonly CoupCard[] = [
  "Duke",
  "Assassin",
  "Captain",
  "Ambassador",
  "Contessa",
];

export const CARDS_PER_ROLE = 3;
export const CARDS_PER_HAND = 2;

export function createDeck(): CoupCard[] {
  const deck: CoupCard[] = [];
  for (const card of CARDS) {
    for (let i = 0; i < CARDS_PER_ROLE; i++) {
      deck.push(card);
    }
  }
  return deck;
}

/** Fisher-Yates shuffle (mutates and returns the array) */
export function shuffle(deck: CoupCard[]): CoupCard[] {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = deck[i];
    const tmp2 = deck[j];
    if (tmp !== undefined && tmp2 !== undefined) {
      deck[i] = tmp2;
      deck[j] = tmp;
    }
  }
  return deck;
}

/**
 * Deal `count` cards from the top of the deck.
 * Returns the dealt cards and the remaining deck.
 */
export function deal(
  deck: readonly CoupCard[],
  count: number,
): { dealt: CoupCard[]; remaining: CoupCard[] } {
  const dealt = deck.slice(0, count) as CoupCard[];
  const remaining = deck.slice(count) as CoupCard[];
  return { dealt, remaining };
}

/**
 * Return a card to the deck and reshuffle.
 */
export function returnAndShuffle(
  deck: readonly CoupCard[],
  card: CoupCard,
): CoupCard[] {
  return shuffle([...deck, card]);
}
