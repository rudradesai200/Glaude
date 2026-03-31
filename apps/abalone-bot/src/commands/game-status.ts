import { AttachmentBuilder, type ChatInputCommandInteraction } from "discord.js";
import type { SessionManager } from "../session-manager.js";

export const execute = async (
  interaction: ChatInputCommandInteraction,
  sessionManager: SessionManager,
): Promise<void> => {
  const session = sessionManager.getSession(interaction.channelId);

  if (!session) {
    await interaction.reply({ content: "No active game in this channel.", ephemeral: true });
    return;
  }

  if (session.phase === "LOBBY") {
    const waiting = session.seats.map((id) => `<@${id}>`).join(", ");
    await interaction.reply(
      `Lobby open — players: ${waiting}. Use \`/game join\` to join.`,
    );
    return;
  }

  if (session.phase !== "PLAYING") {
    await interaction.reply({ content: "The game has ended.", ephemeral: true });
    return;
  }

  await interaction.deferReply();

  const { definition, state, seats } = session;
  const renderCtx = definition.buildRenderContext(state, seats);
  const png = await definition.render(renderCtx) as Uint8Array;
  const attachment = new AttachmentBuilder(Buffer.from(png), { name: "board.png" });
  const currentTurn = definition.currentTurn(state) as string;

  await interaction.editReply({
    content: `It is <@${currentTurn}>'s turn.`,
    files: [attachment],
  });
};
