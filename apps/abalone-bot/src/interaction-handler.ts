import { Events } from "discord.js";
import type { Client, Interaction } from "discord.js";
import { GlaudeError } from "@glaude/shared";
import type { SessionManager } from "./session-manager.js";
import type { Db } from "./db/client.js";
import { execute as executeStart } from "./commands/game-start.js";
import { execute as executeJoin } from "./commands/game-join.js";
import { execute as executeForfeit } from "./commands/game-forfeit.js";
import { execute as executeStatus } from "./commands/game-status.js";
import { execute as executeMove } from "./commands/game-move.js";

export const registerInteractionHandler = (
  client: Client,
  sessionManager: SessionManager,
  db: Db,
): void => {
  client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    if (!interaction.isChatInputCommand()) return;

    try {
      if (interaction.commandName === "abalone") {
        const sub = interaction.options.getSubcommand();
        if (sub === "start") await executeStart(interaction, sessionManager, db);
        else if (sub === "join") await executeJoin(interaction, sessionManager, db);
        else if (sub === "forfeit") await executeForfeit(interaction, sessionManager);
        else if (sub === "status") await executeStatus(interaction, sessionManager);
        else if (sub === "move") await executeMove(interaction, sessionManager);
      }
    } catch (error) {
      const message =
        error instanceof GlaudeError
          ? error.message
          : "An unexpected error occurred. Please try again.";
      const reply = { content: message, ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(reply);
      } else {
        await interaction.reply(reply);
      }
    }
  });
};
