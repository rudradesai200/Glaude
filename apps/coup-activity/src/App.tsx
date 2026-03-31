import type { SdkAuth } from "./discord-sdk.js";
import { CoupProvider } from "./coup/coup-context.js";
import { CoupGame } from "./coup/CoupGame.js";

export function App({ auth }: { auth: SdkAuth }) {
  return (
    <CoupProvider auth={auth}>
      <CoupGame />
    </CoupProvider>
  );
}
