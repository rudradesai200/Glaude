import type { ChatInputCommandInteraction } from "discord.js";
import { PlayerId } from "@glaude/shared";
import type { SessionManager } from "../session-manager.js";
import type { Db } from "../db/client.js";
import { ensurePlayer } from "../db/repository.js";

export const execute = async (
  interaction: ChatInputCommandInteraction,
  sessionManager: SessionManager,
  db: Db,
): Promise<void> => {
  const gameId = interaction.options.getString("game", true);
  const playerId = PlayerId(interaction.user.id);

  ensurePlayer(db, playerId, interaction.user.username);

  const result = sessionManager.createLobby(interaction.channelId, gameId, playerId);
  if (!result.ok) {
    await interaction.reply({ content: result.error, ephemeral: true });
    return;
  }

  await interaction.reply(
    `Lobby created for **${result.value.gameId}**! Use \`/game join\` to join. Waiting for 1 more player...`,
  );
};
