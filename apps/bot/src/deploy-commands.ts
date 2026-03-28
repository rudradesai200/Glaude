import { REST, Routes, SlashCommandBuilder } from "discord.js";

const token = process.env["DISCORD_TOKEN"];
const clientId = process.env["DISCORD_CLIENT_ID"];
const guildId = process.env["DISCORD_GUILD_ID"]; // optional: faster dev registration (guild-scoped)

if (!token) throw new Error("DISCORD_TOKEN is required");
if (!clientId) throw new Error("DISCORD_CLIENT_ID is required");

const gameCommand = new SlashCommandBuilder()
  .setName("game")
  .setDescription("Manage a game session in this channel")
  .addSubcommand((sub) =>
    sub
      .setName("start")
      .setDescription("Create a new game lobby in this channel")
      .addStringOption((opt) =>
        opt
          .setName("game")
          .setDescription("Which game to play")
          .setRequired(true)
          .addChoices({ name: "Abalone", value: "abalone" }),
      ),
  )
  .addSubcommand((sub) =>
    sub.setName("join").setDescription("Join the active lobby in this channel"),
  )
  .addSubcommand((sub) =>
    sub.setName("forfeit").setDescription("Forfeit the current game"),
  )
  .addSubcommand((sub) =>
    sub.setName("status").setDescription("Show the current board state"),
  )
  .addSubcommand((sub) =>
    sub
      .setName("move")
      .setDescription("Play a move in the current game")
      .addStringOption((opt) =>
        opt
          .setName("move")
          .setDescription(
            "Move notation: <inline|broadside> <q,r[+q,r[+q,r]]> <E|NE|NW|W|SW|SE>",
          )
          .setRequired(true),
      ),
  );

const rest = new REST().setToken(token);

const route = guildId
  ? Routes.applicationGuildCommands(clientId, guildId)
  : Routes.applicationCommands(clientId);

// Fetch existing commands so we can preserve the auto-created Entry Point
// command (type 4) that Discord requires when Activities is enabled.
const existing = await rest.get(route) as { type: number; id: string; name: string }[];
const entryPoints = existing.filter((c) => c.type === 4);

const body = [gameCommand.toJSON(), ...entryPoints];

const result = await rest.put(route, { body });
console.log(
  `Registered ${Array.isArray(result) ? result.length : "?"} application command(s).`,
);
