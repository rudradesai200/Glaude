import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import { initDiscordSdk, type SdkAuth } from "./discord-sdk.js";

const root = document.getElementById("root");
if (!root) throw new Error("No #root element");

// Must await SDK init before rendering — we need userId + sessionId
// to initialise the GameProvider correctly.
let auth: SdkAuth;
let initError: Error | null = null;
try {
  auth = await initDiscordSdk();
} catch (err) {
  const error = err instanceof Error ? err : new Error(String(err));
  console.error("[discord-sdk] init failed:", error);
  initError = error;
  // Fall back to anonymous local play so the screen isn't blank.
  auth = { userId: "player1", username: "player1", avatarUrl: null, sessionId: null, gameId: "coup" };
}

createRoot(root).render(
  <StrictMode>
    {initError && (
      <div
        style={{
          position: "fixed",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#111",
          flexDirection: "column",
          gap: 12,
          padding: 20,
          fontFamily: "monospace",
        }}
      >
        <div style={{ color: "#ef4444", fontSize: 14, fontWeight: "bold" }}>
          Discord SDK Init Failed
        </div>
        <div
          style={{
            color: "#f87171",
            fontSize: 12,
            maxWidth: 400,
            overflow: "auto",
            background: "rgba(127, 29, 29, 0.1)",
            padding: 12,
            borderRadius: 4,
            border: "1px solid rgba(239, 68, 68, 0.3)",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {initError.message}
        </div>
      </div>
    )}
    <App auth={auth} />
  </StrictMode>,
);
