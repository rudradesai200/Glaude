import { DiscordSDK, patchUrlMappings, type DiscordSDKMock } from "@discord/embedded-app-sdk";

export type SdkAuth = {
  userId: string;
  username: string;
  avatarUrl: string | null;
  sessionId: string | null;
  wsUrl?: string;
  gameId: string;
};

let _sdk: DiscordSDK | DiscordSDKMock | null = null;

export async function initDiscordSdk(): Promise<SdkAuth> {
  const clientId = import.meta.env["VITE_DISCORD_CLIENT_ID"];
  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get("sessionId");
  const gameId = params.get("gameId") ?? "abalone";

  // Outside the Discord iframe (no frame_id param) — fall back to query-string.
  const insideDiscord = params.has("frame_id");
  if (!clientId || !insideDiscord) {
    const userId = params.get("userId") ?? "player1";
    return {
      userId,
      username: userId,
      avatarUrl: null,
      sessionId,
      gameId,
    };
  }

  // Patch fetch + WebSocket so all calls route through Discord's /.proxy/
  // This must happen before any network calls.
  patchUrlMappings([
    { prefix: "/api", target: "localhost:3002" },
    { prefix: "/ws", target: "localhost:3001" },
  ]);

  const sdk = new DiscordSDK(clientId);
  _sdk = sdk;

  await sdk.ready();

  const channelId = sdk.channelId;

  const { code } = await sdk.commands.authorize({
    client_id: clientId,
    response_type: "code",
    state: "",
    prompt: "none",
    scope: ["identify"],
  });

  const { access_token } = await fetch("/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  }).then((r) => r.json() as Promise<{ access_token: string }>);

  const auth = await sdk.commands.authenticate({ access_token });

  const avatarUrl = auth.user.avatar
    ? `https://cdn.discordapp.com/avatars/${auth.user.id}/${auth.user.avatar}.png?size=128`
    : null;

  const result = {
    userId: auth.user.id,
    username: auth.user.username,
    avatarUrl,
    sessionId: channelId ?? null,
    wsUrl: channelId ? `wss://${window.location.host}/ws` : undefined,
    gameId,
  };
  console.log("[discord-sdk] auth result:", result);
  return result;
}

export function getDiscordSdk(): DiscordSDK | DiscordSDKMock | null {
  return _sdk;
}
