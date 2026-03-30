import type { GameDefinition } from "@glaude/engine";
import { abaloneDefinition } from "@glaude/game-abalone";
import { coupDefinition } from "@glaude/game-coup";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const registry = new Map<string, GameDefinition<any, any, any>>([
  [abaloneDefinition.id, abaloneDefinition],
  [coupDefinition.id, coupDefinition],
]);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const findGame = (id: string): GameDefinition<any, any, any> | undefined =>
  registry.get(id);

export const listGames = (): readonly string[] => [...registry.keys()];
