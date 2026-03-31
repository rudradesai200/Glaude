import { useCoup } from "./coup-context.js";
import { PlayerList } from "./components/PlayerList.js";
import { Hand } from "./components/Hand.js";
import { ActionPanel } from "./components/ActionPanel.js";
import { ResponsePanel } from "./components/ResponsePanel.js";
import { Timer } from "./components/Timer.js";
import { RevealPrompt } from "./components/RevealPrompt.js";
import { ExchangePicker } from "./components/ExchangePicker.js";
import { Log } from "./components/Log.js";

function CoupWinScreen() {
  const { gameOver, myPlayerId } = useCoup();
  if (!gameOver) return null;

  const iWon = gameOver.winner === myPlayerId;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.88)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        zIndex: 100,
      }}
    >
      <div style={{ fontSize: 56, lineHeight: 1 }}>{iWon ? "👑" : "💀"}</div>
      <div
        style={{
          fontSize: 28,
          fontWeight: 800,
          color: iWon ? "#facc15" : "#64748b",
        }}
      >
        {iWon ? "Victory!" : "Eliminated"}
      </div>
      {gameOver.winner && !iWon && (
        <div style={{ fontSize: 14, color: "#94a3b8" }}>
          Winner: {gameOver.winner}
        </div>
      )}
      <div style={{ fontSize: 13, color: "#6b7280", marginTop: 8 }}>
        Return to Discord to start a new game
      </div>
    </div>
  );
}

export function CoupGame() {
  const { connected, gameOver } = useCoup();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        minHeight: "100dvh",
        padding: "8px 12px 16px",
        background: "#111",
        gap: 12,
        fontFamily: "system-ui, sans-serif",
        color: "#e5e7eb",
        boxSizing: "border-box",
        maxWidth: 480,
        margin: "0 auto",
        width: "100%",
      }}
    >
      {/* Connection indicator */}
      {!connected && (
        <div
          style={{
            width: "100%",
            textAlign: "center",
            padding: "6px 0",
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: 6,
            color: "#fca5a5",
            fontSize: 12,
          }}
        >
          Reconnecting…
        </div>
      )}

      {/* Player list */}
      <PlayerList />

      {/* Divider */}
      <div style={{ width: "100%", height: 1, background: "rgba(255,255,255,0.06)" }} />

      {/* My hand */}
      <Hand />

      {/* Active input area — only one renders at a time */}
      <ActionPanel />
      <ResponsePanel />
      <RevealPrompt />
      <ExchangePicker />

      {/* Timer — shown when awaiting my response */}
      <Timer />

      {/* Divider */}
      <div style={{ width: "100%", height: 1, background: "rgba(255,255,255,0.06)" }} />

      {/* Game log */}
      <Log />

      {/* Win/loss overlay */}
      {gameOver && <CoupWinScreen />}
    </div>
  );
}
