import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import { initDiscordSdk, type SdkAuth } from "./discord-sdk.js";

const root = document.getElementById("root");
if (!root) throw new Error("No #root element");

// Must await SDK init before rendering — we need userId + sessionId
// to initialise the GameProvider correctly.
let auth: SdkAuth;
try {
  auth = await initDiscordSdk();
} catch (err) {
  console.error("[discord-sdk] init failed:", err);
  // Fall back to anonymous local play so the screen isn't blank.
  auth = { userId: "player1", sessionId: null, gameId: "abalone" };
}

createRoot(root).render(
  <StrictMode>
    <App auth={auth} />
  </StrictMode>,
);
