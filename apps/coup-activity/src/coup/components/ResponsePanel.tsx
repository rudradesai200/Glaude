import { useState } from "react";
import { useCoup } from "../coup-context.js";
import type { CoupCard, CoupMove } from "@glaude/game-coup";

// Cards that can be used to block each action
const BLOCK_OPTIONS: Record<string, CoupCard[]> = {
  ForeignAid: ["Duke"],
  Assassinate: ["Contessa"],
  Steal: ["Captain", "Ambassador"],
};

const CARD_EMOJI: Record<string, string> = {
  Duke: "👑",
  Assassin: "🗡️",
  Captain: "⚓",
  Ambassador: "🤝",
  Contessa: "🌹",
};

function Btn({
  label,
  onClick,
  color = "blue",
}: {
  label: string;
  onClick: () => void;
  color?: "blue" | "red" | "gray" | "purple";
}) {
  const colors = {
    blue: { bg: "rgba(59,130,246,0.15)", border: "rgba(59,130,246,0.4)", text: "#93c5fd" },
    red: { bg: "rgba(239,68,68,0.15)", border: "rgba(239,68,68,0.4)", text: "#fca5a5" },
    gray: { bg: "rgba(107,114,128,0.15)", border: "rgba(107,114,128,0.4)", text: "#9ca3af" },
    purple: { bg: "rgba(139,92,246,0.15)", border: "rgba(139,92,246,0.4)", text: "#c4b5fd" },
  };
  const c = colors[color];
  return (
    <button
      onClick={onClick}
      style={{
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: 8,
        color: c.text,
        padding: "8px 16px",
        cursor: "pointer",
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      {label}
    </button>
  );
}

export function ResponsePanel() {
  const { view, myPlayerId, sendMove } = useCoup();
  const [showBlockPicker, setShowBlockPicker] = useState(false);

  const phase = view.phase;
  const pending = view.pendingAction;

  // AWAIT_CHALLENGE_BLOCK: non-actor, not-yet-responded players
  if (phase === "AWAIT_CHALLENGE_BLOCK") {
    if (!pending) return null;
    if (pending.actor === myPlayerId) return null;
    if (view.responded.includes(myPlayerId)) return null;

    const canChallenge = Boolean(pending.claimedCard);
    const blockCards = pending.action in BLOCK_OPTIONS ? BLOCK_OPTIONS[pending.action] ?? [] : [];
    const isTarget = pending.target === myPlayerId;
    const isForeignAid = pending.action === "ForeignAid";
    const canBlock = blockCards.length > 0 && (isTarget || isForeignAid);

    const sendPass = () => sendMove({ kind: "PASS" });
    const sendChallenge = () => sendMove({ kind: "CHALLENGE" });
    const sendBlock = (card: CoupCard) => {
      sendMove({ kind: "BLOCK", claimedCard: card });
      setShowBlockPicker(false);
    };

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
        <div style={{ color: "#9ca3af", fontSize: 12, textAlign: "center" }}>
          {pending.actor} declared <strong style={{ color: "#e5e7eb" }}>{pending.action}</strong>
          {pending.target ? ` → ${pending.target === myPlayerId ? "you" : pending.target}` : ""}
        </div>
        {showBlockPicker ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "center" }}>
            <div style={{ color: "#9ca3af", fontSize: 12 }}>Block as…</div>
            <div style={{ display: "flex", gap: 8 }}>
              {blockCards.map((card) => (
                <Btn
                  key={card}
                  label={`${CARD_EMOJI[card] ?? ""} ${card}`}
                  onClick={() => sendBlock(card)}
                  color="purple"
                />
              ))}
            </div>
            <Btn label="Cancel" onClick={() => setShowBlockPicker(false)} color="gray" />
          </div>
        ) : (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
            <Btn label="Pass" onClick={sendPass} color="gray" />
            {canChallenge && <Btn label="Challenge" onClick={sendChallenge} color="red" />}
            {canBlock && (
              <Btn
                label={blockCards.length === 1 ? `Block (${blockCards[0]})` : "Block…"}
                onClick={() => {
                  if (blockCards.length === 1 && blockCards[0]) {
                    sendBlock(blockCards[0]);
                  } else {
                    setShowBlockPicker(true);
                  }
                }}
                color="purple"
              />
            )}
          </div>
        )}
      </div>
    );
  }

  // AWAIT_BLOCK_CHALLENGE: only the actor
  if (phase === "AWAIT_BLOCK_CHALLENGE") {
    if (!pending) return null;
    if (pending.actor !== myPlayerId) return null;
    if (view.responded.includes(myPlayerId)) return null;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
        <div style={{ color: "#9ca3af", fontSize: 12, textAlign: "center" }}>
          {pending.blocker} blocked with{" "}
          <strong style={{ color: "#e5e7eb" }}>{pending.blockedCard}</strong>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn label="Pass (accept block)" onClick={() => sendMove({ kind: "PASS" })} color="gray" />
          <Btn label="Challenge" onClick={() => sendMove({ kind: "CHALLENGE" })} color="red" />
        </div>
      </div>
    );
  }

  return null;
}
