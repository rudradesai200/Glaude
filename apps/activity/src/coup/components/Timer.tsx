import { useEffect, useState, useRef } from "react";
import { useCoup } from "../coup-context.js";

const AUTO_PASS_DELAY_MS = 15_000;

/** Shows a countdown when it's the current player's turn to respond. */
export function Timer() {
  const { view, myPlayerId } = useCoup();
  const [remaining, setRemaining] = useState<number | null>(null);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  // Determine if I must respond
  const phase = view.phase;
  const pending = view.pendingAction;

  const mustRespond = (() => {
    if (phase === "AWAIT_CHALLENGE_BLOCK") {
      if (!pending || pending.actor === myPlayerId) return false;
      if (view.responded.includes(myPlayerId)) return false;
      return true;
    }
    if (phase === "AWAIT_BLOCK_CHALLENGE") {
      if (!pending || pending.actor !== myPlayerId) return false;
      if (view.responded.includes(myPlayerId)) return false;
      return true;
    }
    return false;
  })();

  useEffect(() => {
    if (!mustRespond) {
      setRemaining(null);
      startRef.current = null;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    startRef.current = Date.now();

    const tick = () => {
      const elapsed = Date.now() - (startRef.current ?? Date.now());
      const left = Math.max(0, AUTO_PASS_DELAY_MS - elapsed);
      setRemaining(left);
      if (left > 0) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [mustRespond, phase, pending?.actor, pending?.blocker]);

  if (!mustRespond || remaining === null) return null;

  const secs = Math.ceil(remaining / 1000);
  const fraction = remaining / AUTO_PASS_DELAY_MS;
  const urgent = secs <= 5;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
      }}
    >
      <div
        style={{
          width: 120,
          height: 4,
          background: "rgba(255,255,255,0.1)",
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${fraction * 100}%`,
            background: urgent ? "#ef4444" : "#3b82f6",
            transition: "background 0.3s",
          }}
        />
      </div>
      <span
        style={{
          fontSize: 11,
          color: urgent ? "#ef4444" : "#6b7280",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        auto-pass in {secs}s
      </span>
    </div>
  );
}
