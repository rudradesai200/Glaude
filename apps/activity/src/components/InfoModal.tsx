const RULES = [
  {
    heading: "Objective",
    body: "Push 6 of your opponent's marbles off the board to win.",
  },
  {
    heading: "Moving marbles",
    body: "Select 1–3 of your marbles (they must be in a line), then tap an arrow to move.",
  },
  {
    heading: "Inline move",
    body: "Move your line of marbles in the direction they're already pointing. You can push opponent marbles if you outnumber them (e.g. 3 vs 2, or 2 vs 1).",
  },
  {
    heading: "Broadside move",
    body: "Move your line sideways (perpendicular to the line). You cannot push opponent marbles this way.",
  },
  {
    heading: "Sumito (pushing)",
    body: "You need more marbles than your opponent to push. You can never push 3 opponent marbles, and you can't push your own marbles.",
  },
  {
    heading: "Capture",
    body: "A marble is captured when it gets pushed off the edge. First to capture 6 wins.",
  },
];

export function InfoModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 200,
        padding: "16px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#1e293b",
          borderRadius: "12px",
          padding: "24px",
          maxWidth: "380px",
          width: "100%",
          fontFamily: "system-ui, sans-serif",
          color: "#f0f0f0",
          boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
          }}
        >
          <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 700 }}>
            How to play Abalone
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "#94a3b8",
              fontSize: "20px",
              cursor: "pointer",
              lineHeight: 1,
              padding: "2px 6px",
            }}
          >
            ×
          </button>
        </div>

        {/* Rules */}
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {RULES.map(({ heading, body }) => (
            <div key={heading}>
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "#4ade80",
                  marginBottom: "3px",
                }}
              >
                {heading}
              </div>
              <div style={{ fontSize: "14px", color: "#cbd5e1", lineHeight: "1.5" }}>
                {body}
              </div>
            </div>
          ))}
        </div>

        {/* Footer tip */}
        <div
          style={{
            marginTop: "20px",
            paddingTop: "16px",
            borderTop: "1px solid #334155",
            fontSize: "12px",
            color: "#475569",
            textAlign: "center",
          }}
        >
          Tap a marble to select it · Tap an arrow to move
        </div>
      </div>
    </div>
  );
}
