import type { SdkAuth } from "./discord-sdk.js";
import { GameProvider, useGame } from "./game-context.js";
import { BoardSVG } from "./components/BoardSVG.js";
import { HUD } from "./components/HUD.js";
import { WinScreen } from "./components/WinScreen.js";
import { CoupProvider } from "./coup/coup-context.js";
import { CoupGame } from "./coup/CoupGame.js";

function AbaloneView() {
  const { gameOver } = useGame();
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        minHeight: "100dvh",
        padding: "8px 0 16px",
        background: "#111",
      }}
    >
      <HUD />
      <BoardSVG />
      {gameOver && <WinScreen />}
    </div>
  );
}

export function App({ auth }: { auth: SdkAuth }) {
  if (auth.gameId === "coup") {
    return (
      <CoupProvider auth={auth}>
        <CoupGame />
      </CoupProvider>
    );
  }

  return (
    <GameProvider auth={auth}>
      <AbaloneView />
    </GameProvider>
  );
}
