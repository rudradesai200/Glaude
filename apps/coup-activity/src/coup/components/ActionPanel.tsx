import { useCoup } from "../coup-context.js";
import type { CoupActionType, CoupMove } from "@glaude/game-coup";
import type { PlayerId } from "@glaude/shared";

const COUP_COST = 7;
const MUST_COUP_AT = 10;
const ASSASSINATE_COST = 3;

type ActionDef = {
  action: CoupActionType;
  label: string;
  emoji: string;
  needsTarget: boolean;
  minCoins?: number;
  description: string;
};

const ACTIONS: ActionDef[] = [
  { action: "Income", label: "Income", emoji: "💰", needsTarget: false, description: "+1 coin" },
  { action: "ForeignAid", label: "Foreign Aid", emoji: "🏦", needsTarget: false, description: "+2 coins (blockable)" },
  { action: "Tax", label: "Tax", emoji: "👑", needsTarget: false, description: "+3 coins (Duke)" },
  { action: "Exchange", label: "Exchange", emoji: "🤝", needsTarget: false, description: "Swap cards (Ambassador)" },
  { action: "Steal", label: "Steal", emoji: "⚓", needsTarget: true, description: "+2 from target (Captain)" },
  { action: "Assassinate", label: "Assassinate", emoji: "🗡️", needsTarget: true, minCoins: ASSASSINATE_COST, description: `Pay ${ASSASSINATE_COST}: eliminate influence (Assassin)` },
  { action: "Coup", label: "Coup", emoji: "💣", needsTarget: true, minCoins: COUP_COST, description: `Pay ${COUP_COST}: force reveal (unblockable)` },
];

function ActionButton({
  label,
  emoji,
  description,
  disabled,
  onClick,
}: {
  label: string;
  emoji: string;
  description: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={description}
      style={{
        background: disabled ? "rgba(55,65,81,0.4)" : "rgba(59,130,246,0.15)",
        border: disabled ? "1px solid rgba(107,114,128,0.3)" : "1px solid rgba(59,130,246,0.4)",
        borderRadius: 8,
        color: disabled ? "#6b7280" : "#93c5fd",
        padding: "8px 12px",
        cursor: disabled ? "not-allowed" : "pointer",
        fontSize: 13,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
        minWidth: 72,
        transition: "background 0.15s",
      }}
    >
      <span style={{ fontSize: 20 }}>{emoji}</span>
      <span style={{ fontWeight: 600 }}>{label}</span>
    </button>
  );
}

export function ActionPanel() {
  const { view, myPlayerId, sendMove } = useCoup();

  if (view.phase !== "ACTION") return null;

  const actor = view.turnOrder[view.turnIndex];
  if (actor !== myPlayerId) return null;

  const me = view.players.find((p) => p.playerId === myPlayerId);
  const myCoins = me?.coins ?? 0;
  const mustCoup = myCoins >= MUST_COUP_AT;

  const otherActivePlayers = view.players.filter(
    (p) => p.playerId !== myPlayerId && p.influence.some((inf) => !inf.revealed),
  );

  const handleAction = (action: CoupActionType, target?: PlayerId) => {
    const move: CoupMove =
      target !== undefined
        ? { kind: "ACTION", action, target }
        : { kind: "ACTION", action };
    sendMove(move);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ color: "#9ca3af", fontSize: 12, textAlign: "center" }}>
        {mustCoup ? "You must Coup (≥10 coins)" : "Choose an action"}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
        {ACTIONS.map((def) => {
          if (mustCoup && def.action !== "Coup") return null;

          const affordable = myCoins >= (def.minCoins ?? 0);
          const available = affordable;

          if (!def.needsTarget) {
            return (
              <ActionButton
                key={def.action}
                label={def.label}
                emoji={def.emoji}
                description={def.description}
                disabled={!available}
                onClick={() => handleAction(def.action)}
              />
            );
          }

          // Needs target — render one button per valid target
          return otherActivePlayers.map((target) => (
            <ActionButton
              key={`${def.action}-${target.playerId}`}
              label={`${def.label}: ${target.playerId}`}
              emoji={def.emoji}
              description={`${def.description} → ${target.playerId}`}
              disabled={!available || (def.action === "Steal" && target.coins === 0)}
              onClick={() => handleAction(def.action, target.playerId)}
            />
          ));
        })}
      </div>
    </div>
  );
}
