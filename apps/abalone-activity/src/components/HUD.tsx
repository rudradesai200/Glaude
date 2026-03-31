import { useState } from "react";
import { useGame } from "../game-context.js";
import { countMarbles } from "@glaude/game-abalone/board";
import { InfoModal } from "./InfoModal.js";

const styles = {
  hud: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: "12px",
    padding: "12px 24px",
    fontFamily: "system-ui, sans-serif",
    color: "#f0f0f0",
  },
  row: {
    display: "flex",
    gap: "32px",
    alignItems: "center",
  },
  dot: (fill: string, isActive: boolean) => ({
    width: "18px",
    height: "18px",
    borderRadius: "50%",
    background: fill,
    border: isActive ? "2px solid #facc15" : "2px solid transparent",
    transition: "border-color 0.2s",
  }),
  turnBanner: (isMyTurn: boolean) => ({
    fontSize: "13px",
    fontWeight: 600,
    letterSpacing: "0.04em",
    color: isMyTurn ? "#4ade80" : "#94a3b8",
    textTransform: "uppercase" as const,
  }),
  offlineDot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    background: "#ef4444",
    marginRight: "6px",
    display: "inline-block",
  },
  actionRow: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
  },
  forfeitBtn: {
    padding: "6px 16px",
    background: "transparent",
    border: "1px solid #475569",
    borderRadius: "6px",
    color: "#94a3b8",
    fontSize: "12px",
    cursor: "pointer",
  },
  confirmRow: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
    fontSize: "12px",
    color: "#94a3b8",
  },
  confirmBtn: (danger: boolean) => ({
    padding: "5px 12px",
    background: danger ? "#dc2626" : "transparent",
    border: danger ? "none" : "1px solid #475569",
    borderRadius: "6px",
    color: danger ? "#fff" : "#94a3b8",
    fontSize: "12px",
    cursor: "pointer",
  }),
  infoBtn: {
    width: "26px",
    height: "26px",
    borderRadius: "50%",
    background: "transparent",
    border: "1px solid #475569",
    color: "#94a3b8",
    fontSize: "13px",
    fontWeight: 700,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    lineHeight: 1,
  },
};

export function HUD() {
  const { state, myPlayerId, opponentId, blackPlayerId, connected, gameOver, forfeit } = useGame();
  const [confirmingForfeit, setConfirmingForfeit] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  const isMyTurn = state.turn === myPlayerId;
  const myMarbles = countMarbles(state.board, myPlayerId);
  const opponentMarbles = countMarbles(state.board, opponentId);
  const myCaptured = state.capturedBy[myPlayerId] ?? 0;
  const opponentCaptured = state.capturedBy[opponentId] ?? 0;

  const myColor = myPlayerId === blackPlayerId ? "#1a1a1a" : "#f0f0f0";
  const opponentColor = myPlayerId === blackPlayerId ? "#f0f0f0" : "#1a1a1a";

  const handleForfeitConfirm = () => {
    setConfirmingForfeit(false);
    forfeit();
  };

  return (
    <>
      <div style={styles.hud}>
        {/* Connection status */}
        {!connected && (
          <div style={{ fontSize: "12px", color: "#ef4444" }}>
            <span style={styles.offlineDot} />
            Reconnecting…
          </div>
        )}

        {/* Turn indicator (hidden when game over — WinScreen takes over) */}
        {!gameOver && (
          <div style={styles.turnBanner(isMyTurn)}>
            {isMyTurn ? "Your turn" : "Opponent's turn"}
          </div>
        )}

        {/* Marble counts */}
        <div style={styles.row}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "15px" }}>
            <div style={styles.dot(myColor, isMyTurn)} />
            <span>{myMarbles} marbles &nbsp;·&nbsp; {myCaptured} captured</span>
          </div>
          <div style={{ color: "#475569" }}>vs</div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "15px" }}>
            <div style={styles.dot(opponentColor, !isMyTurn)} />
            <span>{opponentMarbles} marbles &nbsp;·&nbsp; {opponentCaptured} captured</span>
          </div>
        </div>

        {/* Actions: forfeit + info */}
        {!gameOver && (
          <div style={styles.actionRow}>
            {confirmingForfeit ? (
              <div style={styles.confirmRow}>
                <span>Forfeit game?</span>
                <button style={styles.confirmBtn(true)} onClick={handleForfeitConfirm}>
                  Forfeit
                </button>
                <button style={styles.confirmBtn(false)} onClick={() => setConfirmingForfeit(false)}>
                  Cancel
                </button>
              </div>
            ) : (
              <button style={styles.forfeitBtn} onClick={() => setConfirmingForfeit(true)}>
                Forfeit
              </button>
            )}
            <button style={styles.infoBtn} onClick={() => setShowInfo(true)} title="How to play">
              i
            </button>
          </div>
        )}

        {/* Info button only when game over */}
        {gameOver && (
          <button style={styles.infoBtn} onClick={() => setShowInfo(true)} title="How to play">
            i
          </button>
        )}
      </div>

      {showInfo && <InfoModal onClose={() => setShowInfo(false)} />}
    </>
  );
}
