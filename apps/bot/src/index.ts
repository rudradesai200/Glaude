import { Events } from "discord.js";
import { createClient } from "./client.js";
import { registerInteractionHandler } from "./interaction-handler.js";
import { SessionManager } from "./session-manager.js";
import { createDb } from "./db/client.js";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { startWsServer } from "./ws-server.js";
import { startApiServer } from "./api-server.js";

const token = process.env["DISCORD_TOKEN"];
if (!token) throw new Error("DISCORD_TOKEN is required");

const dbPath = process.env["DATABASE_URL"] ?? "./data/glaude.db";
const db = createDb(dbPath);

// Run migrations from the drizzle/ folder (relative to this file's package root)
const migrationsFolder = resolve(fileURLToPath(import.meta.url), "../../drizzle");
migrate(db, { migrationsFolder });

const sessionManager = new SessionManager(db);
sessionManager.recover();

startWsServer(sessionManager);
startApiServer();

const client = createClient();
registerInteractionHandler(client, sessionManager, db);

client.once(Events.ClientReady, (ready) => {
  console.log(`Glaude bot ready — logged in as ${ready.user.tag}`);
});

await client.login(token);
