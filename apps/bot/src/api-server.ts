import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

const DISCORD_TOKEN_URL = "https://discord.com/api/oauth2/token";

async function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk: Buffer) => { body += chunk.toString(); });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function json(res: ServerResponse, status: number, data: unknown) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(body);
}

export function startApiServer(): void {
  const clientId = process.env["DISCORD_CLIENT_ID"];
  const clientSecret = process.env["DISCORD_CLIENT_SECRET"];
  const port = Number(process.env["API_PORT"] ?? 3002);

  if (!clientId || !clientSecret) {
    console.warn("[api] DISCORD_CLIENT_ID or DISCORD_CLIENT_SECRET not set — /api/token disabled");
    return;
  }

  const server = createServer(async (req, res) => {
    // CORS preflight
    if (req.method === "OPTIONS") {
      res.writeHead(204, { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type" });
      res.end();
      return;
    }

    if (req.method === "POST" && req.url === "/api/token") {
      try {
        const body = JSON.parse(await readBody(req)) as { code?: string };
        if (!body.code) { json(res, 400, { error: "missing code" }); return; }

        const params = new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: "authorization_code",
          code: body.code,
        });

        const upstream = await fetch(DISCORD_TOKEN_URL, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: params.toString(),
        });

        const data = await upstream.json() as { access_token?: string; error?: string };
        if (!upstream.ok || !data.access_token) {
          json(res, 400, { error: data.error ?? "token exchange failed" });
          return;
        }

        json(res, 200, { access_token: data.access_token });
      } catch (err) {
        json(res, 500, { error: String(err) });
      }
      return;
    }

    json(res, 404, { error: "not found" });
  });

  server.listen(port, () => {
    console.log(`Glaude API server listening on http://localhost:${port}`);
  });
}
