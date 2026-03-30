import { useEffect, useRef } from "react";
import { useCoup } from "../coup-context.js";

export function Log() {
  const { log } = useCoup();
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [log]);

  if (log.length === 0) return null;

  return (
    <div
      style={{
        width: "100%",
        maxHeight: 120,
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        gap: 2,
        padding: "6px 0",
      }}
    >
      {log.map((entry) => (
        <div
          key={entry.id}
          style={{
            color: "#6b7280",
            fontSize: 11,
            padding: "2px 4px",
            borderLeft: "2px solid rgba(107,114,128,0.3)",
            paddingLeft: 8,
          }}
        >
          {entry.text}
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
