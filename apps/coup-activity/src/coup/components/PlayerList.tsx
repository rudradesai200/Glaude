import { useCoup } from "../coup-context.js";
import type { PlayerView } from "@glaude/game-coup";

const CARD_COLORS: Record<string, string> = {
  Duke: "#7c3aed",
  Assassin: "#b91c1c",
  Captain: "#1d4ed8",
  Ambassador: "#065f46",
  Contessa: "#b45309",
  "?": "#374151",
};

function InfluenceIcon({ card, revealed }: { card: string; revealed: boolean }) {
  const color = revealed ? "#4b5563" : CARD_COLORS[card] ?? "#374151";
  const label = revealed ? `${card} (dead)` : card === "?" ? "?" : card;
  return (
    <span
      title={label}
      style={{
        display: "inline-block",
        width: 28,
        height: 36,
        background: color,
        borderRadius: 4,
        border: revealed ? "1px solid #6b7280" : "1px solid rgba(255,255,255,0.2)",
        opacity: revealed ? 0.45 : 1,
        marginRight: 4,
        textAlign: "center",
        lineHeight: "36px",
        fontSize: 10,
        color: "#fff",
        fontWeight: 700,
        overflow: "hidden",
        letterSpacing: "-0.5px",
        flexShrink: 0,
      }}
    >
      {card === "?" ? "?" : card.slice(0, 3).toUpperCase()}
    </span>
  );
}

function PlayerRow({ player, isActor, isMe }: { player: PlayerView; isActor: boolean; isMe: boolean }) {
  const alive = player.influence.some((inf) => !inf.revealed);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px",
        background: isActor ? "rgba(250,204,21,0.12)" : "rgba(255,255,255,0.04)",
        borderRadius: 8,
        border: isActor ? "1px solid rgba(250,204,21,0.4)" : "1px solid rgba(255,255,255,0.06)",
        opacity: alive ? 1 : 0.4,
      }}
    >
      {isActor && (
        <span style={{ fontSize: 14, marginRight: 2 }}>▶</span>
      )}
      <span style={{ color: "#e5e7eb", fontSize: 13, fontWeight: isMe ? 700 : 400, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {isMe ? "You" : player.playerId}
      </span>
      <span style={{ color: "#fbbf24", fontWeight: 700, fontSize: 13, marginRight: 4 }}>
        {player.coins}🪙
      </span>
      <div style={{ display: "flex" }}>
        {player.influence.map((inf, i) => (
          <InfluenceIcon key={i} card={inf.card} revealed={inf.revealed} />
        ))}
      </div>
    </div>
  );
}

export function PlayerList() {
  const { view, myPlayerId } = useCoup();
  const actorId = view.pendingAction?.actor ?? view.turnOrder[view.turnIndex];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%" }}>
      {view.players.map((p) => (
        <PlayerRow
          key={p.playerId}
          player={p}
          isActor={p.playerId === actorId}
          isMe={p.playerId === myPlayerId}
        />
      ))}
    </div>
  );
}
