import { useCoup } from "../coup-context.js";

const CARD_COLORS: Record<string, string> = {
  Duke: "#7c3aed",
  Assassin: "#b91c1c",
  Captain: "#1d4ed8",
  Ambassador: "#065f46",
  Contessa: "#b45309",
};

const CARD_EMOJI: Record<string, string> = {
  Duke: "👑",
  Assassin: "🗡️",
  Captain: "⚓",
  Ambassador: "🤝",
  Contessa: "🌹",
};

export function RevealPrompt() {
  const { view, myPlayerId, sendMove } = useCoup();

  if (view.phase !== "AWAIT_REVEAL") return null;
  if (view.pendingAction?.target !== myPlayerId) return null;

  const me = view.players.find((p) => p.playerId === myPlayerId);
  if (!me) return null;

  // Build list of unrevealed cards with their original indices
  const unrevealedCards = me.influence
    .map((inf, i) => ({ ...inf, originalIndex: i }))
    .filter((inf) => !inf.revealed);

  if (unrevealedCards.length === 0) return null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
        padding: "12px 16px",
        background: "rgba(239,68,68,0.08)",
        border: "1px solid rgba(239,68,68,0.3)",
        borderRadius: 10,
      }}
    >
      <div style={{ color: "#fca5a5", fontSize: 13, fontWeight: 700, textAlign: "center" }}>
        You must reveal an influence
      </div>
      <div style={{ color: "#9ca3af", fontSize: 12, textAlign: "center" }}>
        Choose a card to lose:
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        {unrevealedCards.map((inf) => {
          const color = CARD_COLORS[inf.card] ?? "#374151";
          return (
            <button
              key={inf.originalIndex}
              onClick={() => sendMove({ kind: "REVEAL", cardIndex: inf.originalIndex })}
              title={`Reveal ${inf.card}`}
              style={{
                width: 72,
                height: 96,
                background: `linear-gradient(145deg, ${color}, ${color}aa)`,
                borderRadius: 8,
                border: "2px solid rgba(239,68,68,0.6)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                cursor: "pointer",
                boxShadow: "0 2px 12px rgba(239,68,68,0.25)",
                transition: "transform 0.1s, box-shadow 0.1s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.06)";
                (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 20px rgba(239,68,68,0.4)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
                (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 2px 12px rgba(239,68,68,0.25)";
              }}
            >
              <span style={{ fontSize: 22 }}>{CARD_EMOJI[inf.card] ?? "🃏"}</span>
              <span style={{ color: "#fff", fontWeight: 700, fontSize: 11 }}>{inf.card}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
