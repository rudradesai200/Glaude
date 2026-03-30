import { useCoup } from "../coup-context.js";

const CARD_COLORS: Record<string, string> = {
  Duke: "#7c3aed",
  Assassin: "#b91c1c",
  Captain: "#1d4ed8",
  Ambassador: "#065f46",
  Contessa: "#b45309",
};

const CARD_DESCRIPTIONS: Record<string, string> = {
  Duke: "Tax (+3). Block Foreign Aid.",
  Assassin: "Assassinate (pay 3). Eliminate target.",
  Captain: "Steal (+2 from target). Block Steal.",
  Ambassador: "Exchange cards with deck. Block Steal.",
  Contessa: "Block Assassinate.",
};

export function Hand() {
  const { view, myPlayerId } = useCoup();
  const me = view.players.find((p) => p.playerId === myPlayerId);
  if (!me) return null;

  const myCards = me.influence.filter((inf) => !inf.revealed);
  if (myCards.length === 0) {
    return (
      <div style={{ textAlign: "center", color: "#6b7280", fontSize: 13, padding: "8px 0" }}>
        You are eliminated.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
      {myCards.map((inf, i) => {
        const color = CARD_COLORS[inf.card] ?? "#374151";
        return (
          <div
            key={i}
            title={CARD_DESCRIPTIONS[inf.card] ?? inf.card}
            style={{
              width: 72,
              height: 96,
              background: `linear-gradient(145deg, ${color}, ${color}aa)`,
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.2)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              padding: 6,
              cursor: "default",
              boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
            }}
          >
            <span style={{ fontSize: 22 }}>{CARD_EMOJI[inf.card] ?? "🃏"}</span>
            <span style={{ color: "#fff", fontWeight: 700, fontSize: 11, textAlign: "center" }}>
              {inf.card}
            </span>
          </div>
        );
      })}
    </div>
  );
}

const CARD_EMOJI: Record<string, string> = {
  Duke: "👑",
  Assassin: "🗡️",
  Captain: "⚓",
  Ambassador: "🤝",
  Contessa: "🌹",
};
