import { REST, Routes, SlashCommandBuilder } from "discord.js";

const token = process.env["DISCORD_TOKEN"];
const clientId = process.env["DISCORD_CLIENT_ID"];
const guildId = process.env["DISCORD_GUILD_ID"];

if (!token || !clientId) {
  throw new Error("DISCORD_TOKEN and DISCORD_CLIENT_ID are required");
}

const safeClientId = clientId;

const commands = [
  new SlashCommandBuilder()
    .setName("abalone")
    .setDescription("Abalone game commands")
    .addSubcommand((sub) =>
      sub
        .setName("start")
        .setDescription("Start a new Abalone game")
    )
    .addSubcommand((sub) =>
      sub.setName("join").setDescription("Join an active game lobby")
    )
    .addSubcommand((sub) =>
      sub.setName("status").setDescription("Show the current game board")
    )
    .addSubcommand((sub) =>
      sub.setName("forfeit").setDescription("Forfeit the current game")
    )
    .addSubcommand((sub) =>
      sub
        .setName("move")
        .setDescription("Submit a move (text fallback)")
        .addStringOption((opt) =>
          opt
            .setName("move")
            .setDescription("Your move")
            .setRequired(true)
        )
    ),
];

const rest = new REST().setToken(token);

async function deployCommands() {
  try {
    console.log("Deploying slash commands...");

    const route = guildId
      ? Routes.applicationGuildCommands(safeClientId, guildId)
      : Routes.applicationCommands(safeClientId);

    // Fetch existing commands
    console.log("Fetching existing commands...");
    const existingCommands = (await rest.get(route)) as Array<{
      id: string;
      name: string;
      integration_types?: number[];
    }>;

    // Find Entry Point command (integration_types includes 1 = Guild Install)
    const entryPoint = existingCommands.find(
      (cmd) =>
        cmd.integration_types?.includes(1) &&
        cmd.name !== "abalone" &&
        cmd.name !== "coup"
    );

    // Build command list, preserving Entry Point if it exists
    const commandsToSubmit = entryPoint
      ? [...commands, entryPoint]
      : commands;

    console.log(`Deploying ${commands.length} command(s)...`);
    await rest.put(route, { body: commandsToSubmit });

    if (guildId) {
      console.log(
        `✅ Commands deployed to guild ${guildId} (local testing)`
      );
    } else {
      console.log("✅ Commands deployed globally (may take up to 1 hour)");
    }

    console.log(`Registered ${commands.length} command groups`);
  } catch (error) {
    console.error("Failed to deploy commands:", error);
    process.exit(1);
  }
}

deployCommands();
