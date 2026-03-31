import type { ChatInputCommandInteraction } from "discord.js";
import { PlayerId } from "@glaude/shared";
import type { SessionManager } from "../session-manager.js";

export const execute = async (
  interaction: ChatInputCommandInteraction,
  sessionManager: SessionManager,
): Promise<void> => {
  const playerId = PlayerId(interaction.user.id);

  const result = sessionManager.forfeit(interaction.channelId, playerId);
  if (!result.ok) {
    await interaction.reply({ content: result.error, ephemeral: true });
    return;
  }

  const { outcome } = result.value;
  if (outcome.kind === "FORFEIT") {
    await interaction.reply(
      `<@${outcome.forfeiter}> forfeited. <@${outcome.winner}> wins!`,
    );
  }
};
