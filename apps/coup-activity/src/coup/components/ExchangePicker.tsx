import { useState } from "react";
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

export function ExchangePicker() {
  const { view, myPlayerId, sendMove } = useCoup();
  const [selected, setSelected] = useState<number[]>([]);

  if (view.phase !== "AWAIT_EXCHANGE") return null;
  if (view.pendingAction?.actor !== myPlayerId) return null;

  const me = view.players.find((p) => p.playerId === myPlayerId);
  if (!me) return null;

  // All unrevealed cards with original indices — includes the 2 drawn from deck
  const unrevealedCards = me.influence
    .map((inf, i) => ({ ...inf, originalIndex: i }))
    .filter((inf) => !inf.revealed);

  const toggle = (idx: number) => {
    setSelected((prev) => {
      if (prev.includes(idx)) return prev.filter((i) => i !== idx);
      if (prev.length >= 2) return prev; // max 2
      return [...prev, idx];
    });
  };

  const canSubmit = selected.length === 2;

  const handleSubmit = () => {
    if (!canSubmit) return;
    const [a, b] = selected as [number, number];
    sendMove({ kind: "EXCHANGE_RETURN", keepIndices: [a, b] });
    setSelected([]);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
        padding: "12px 16px",
        background: "rgba(16,185,129,0.06)",
        border: "1px solid rgba(16,185,129,0.3)",
        borderRadius: 10,
      }}
    >
      <div style={{ color: "#6ee7b7", fontSize: 13, fontWeight: 700 }}>
        Exchange — choose 2 cards to keep
      </div>
      <div style={{ color: "#9ca3af", fontSize: 12 }}>
        {selected.length}/2 selected
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
        {unrevealedCards.map((inf) => {
          const isSelected = selected.includes(inf.originalIndex);
          const color = CARD_COLORS[inf.card] ?? "#374151";
          return (
            <button
              key={inf.originalIndex}
              onClick={() => toggle(inf.originalIndex)}
              title={inf.card}
              style={{
                width: 72,
                height: 96,
                background: `linear-gradient(145deg, ${color}, ${color}aa)`,
                borderRadius: 8,
                border: isSelected
                  ? "2px solid #10b981"
                  : "2px solid rgba(255,255,255,0.1)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                cursor: "pointer",
                boxShadow: isSelected ? "0 0 12px rgba(16,185,129,0.5)" : "0 2px 8px rgba(0,0,0,0.4)",
                opacity: !isSelected && selected.length >= 2 ? 0.4 : 1,
                transition: "box-shadow 0.1s, border-color 0.1s, opacity 0.1s",
                position: "relative",
              }}
            >
              {isSelected && (
                <span
                  style={{
                    position: "absolute",
                    top: 4,
                    right: 6,
                    fontSize: 12,
                    color: "#10b981",
                    fontWeight: 700,
                  }}
                >
                  ✓
                </span>
              )}
              <span style={{ fontSize: 22 }}>{CARD_EMOJI[inf.card] ?? "🃏"}</span>
              <span style={{ color: "#fff", fontWeight: 700, fontSize: 11 }}>{inf.card}</span>
            </button>
          );
        })}
      </div>
      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        style={{
          background: canSubmit ? "rgba(16,185,129,0.2)" : "rgba(107,114,128,0.2)",
          border: canSubmit ? "1px solid rgba(16,185,129,0.5)" : "1px solid rgba(107,114,128,0.3)",
          borderRadius: 8,
          color: canSubmit ? "#6ee7b7" : "#6b7280",
          padding: "8px 24px",
          cursor: canSubmit ? "pointer" : "not-allowed",
          fontSize: 13,
          fontWeight: 700,
        }}
      >
        Confirm
      </button>
    </div>
  );
}
