import { AttachmentBuilder, type ChatInputCommandInteraction } from "discord.js";
import { PlayerId } from "@glaude/shared";
import type { SessionManager } from "../session-manager.js";
import type { Db } from "../db/client.js";
import { ensurePlayer } from "../db/repository.js";

export const execute = async (
  interaction: ChatInputCommandInteraction,
  sessionManager: SessionManager,
  db: Db,
): Promise<void> => {
  const playerId = PlayerId(interaction.user.id);

  ensurePlayer(db, playerId, interaction.user.username);

  const result = sessionManager.joinLobby(interaction.channelId, playerId);
  if (!result.ok) {
    await interaction.reply({ content: result.error, ephemeral: true });
    return;
  }

  const session = result.value;
  if (session.phase === "LOBBY") {
    await interaction.reply(
      `<@${playerId}> joined the lobby! Still waiting for more players...`,
    );
    return;
  }

  // PLAYING — game has started; render initial board
  await interaction.deferReply();

  const { definition, state, seats } = session;
  const renderCtx = definition.buildRenderContext(state, seats);
  const png = (await definition.render(renderCtx)) as Uint8Array;
  const attachment = new AttachmentBuilder(Buffer.from(png), { name: "board.png" });

  const black = seats[0];
  const white = seats[1];
  const currentTurn = definition.currentTurn(state) as string;

  await interaction.editReply({
    content: [
      `Game started! <@${black?.playerId}> (Black) vs <@${white?.playerId}> (White).`,
      `<@${currentTurn}> goes first.`,
      `Use \`/game move\` to play. Format: \`[inline|broadside] q,r[+q,r[+q,r]] [E|NE|NW|W|SW|SE]\``,
    ].join("\n"),
    files: [attachment],
  });

  const msg = await interaction.fetchReply();
  sessionManager.setMessageId(interaction.channelId, msg.id);
};
