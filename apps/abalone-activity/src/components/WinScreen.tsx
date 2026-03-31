import type React from "react";
import { useGame } from "../game-context.js";

// Inline SVG crown
function Crown({ size = 48 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Crown body */}
      <path
        d="M4 36 L10 12 L24 26 L32 4 L40 26 L54 12 L60 36 Z"
        fill="#facc15"
        stroke="#f59e0b"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Base band */}
      <rect x="4" y="33" width="56" height="6" rx="3" fill="#f59e0b" />
      {/* Gem dots */}
      <circle cx="32" cy="10" r="3" fill="#fff" opacity="0.9" />
      <circle cx="14" cy="20" r="2.5" fill="#fff" opacity="0.7" />
      <circle cx="50" cy="20" r="2.5" fill="#fff" opacity="0.7" />
    </svg>
  );
}

function Avatar({ url, name, size = 72 }: { url: string | null; name: string; size?: number }) {
  if (url) {
    return (
      <img
        src={url}
        alt={name}
        width={size}
        height={size}
        style={{ borderRadius: "50%", objectFit: "cover" }}
      />
    );
  }
  // Fallback: colored circle with initial
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "#334155",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.4,
        fontWeight: 700,
        color: "#f0f0f0",
        textTransform: "uppercase",
      }}
    >
      {name.charAt(0)}
    </div>
  );
}

const newGameBtn: React.CSSProperties = {
  marginTop: "8px",
  padding: "10px 28px",
  background: "#22c55e",
  border: "none",
  borderRadius: "8px",
  color: "#fff",
  fontSize: "15px",
  fontWeight: 700,
  cursor: "pointer",
  letterSpacing: "0.03em",
};

export function WinScreen() {
  const { gameOver, myPlayerId, myUsername, myAvatarUrl, startNewGame } = useGame();
  if (!gameOver) return null;

  const iWon = gameOver.winner === myPlayerId;
  const isForfeit = gameOver.kind === "FORFEIT";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.85)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "20px",
        fontFamily: "system-ui, sans-serif",
        zIndex: 100,
      }}
    >
      {iWon ? (
        <>
          <Crown size={56} />

          <div
            style={{
              fontSize: "13px",
              fontWeight: 700,
              letterSpacing: "0.2em",
              color: "#facc15",
              textTransform: "uppercase",
            }}
          >
            1st Place
          </div>

          <Avatar url={myAvatarUrl} name={myUsername} size={80} />

          <div style={{ fontSize: "28px", fontWeight: 800, color: "#facc15" }}>
            Victory!
          </div>

          {isForfeit && (
            <div style={{ fontSize: "14px", color: "#94a3b8" }}>
              Opponent forfeited
            </div>
          )}

          <button style={newGameBtn} onClick={startNewGame}>
            New Game
          </button>
        </>
      ) : (
        <>
          {/* Defeat — muted style */}
          <div style={{ fontSize: "64px", lineHeight: 1 }}>😔</div>

          <div style={{ fontSize: "28px", fontWeight: 800, color: "#64748b" }}>
            Defeat
          </div>

          {isForfeit ? (
            <div style={{ fontSize: "14px", color: "#94a3b8" }}>
              You forfeited the game
            </div>
          ) : (
            <div style={{ fontSize: "14px", color: "#94a3b8" }}>
              Better luck next time
            </div>
          )}

          <button style={newGameBtn} onClick={startNewGame}>
            New Game
          </button>
        </>
      )}
    </div>
  );
}
