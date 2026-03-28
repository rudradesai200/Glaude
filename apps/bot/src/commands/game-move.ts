import { AttachmentBuilder, type ChatInputCommandInteraction } from "discord.js";
import { PlayerId } from "@glaude/shared";
import type { GameDefinition } from "@glaude/engine";
import type { SessionManager } from "../session-manager.js";
import type { AbaloneMove, AxialCoord, HexDir } from "@glaude/game-abalone";
import { findGame } from "../games/registry.js";

// ─── Move notation ────────────────────────────────────────────────────────────
// Format: <type> <marbles> <direction>
//   type:      inline | i | broadside | b
//   marbles:   q,r[+q,r[+q,r]]   (1–3 coords joined by +, no spaces)
//   direction: 0–5 or E | NE | NW | W | SW | SE  (case-insensitive)
//
// Examples:
//   inline 0,0 E              (single marble inline east)
//   i -1,0+-1,-1 NE           (two-marble inline northeast)
//   b 0,2+1,2+2,2 NW          (three-marble broadside northwest)

const DIR_MAP: Readonly<Record<string, HexDir>> = {
  "0": 0, "1": 1, "2": 2, "3": 3, "4": 4, "5": 5,
  "e": 0, "ne": 1, "nw": 2, "w": 3, "sw": 4, "se": 5,
};

const MOVE_FORMAT_HELP = [
  "Invalid move format. Use: `<type> <marbles> <direction>`",
  "  **type**: `inline` (or `i`) | `broadside` (or `b`)",
  "  **marbles**: `q,r` or `q,r+q,r` or `q,r+q,r+q,r`",
  "  **direction**: `E` `NE` `NW` `W` `SW` `SE`",
  "Examples: `inline 0,0 E` · `b -1,0+-1,-1 NE` · `inline 0,2+1,2 SW`",
].join("\n");

const parseMove = (raw: string): AbaloneMove | null => {
  const parts = raw.trim().split(/\s+/);
  if (parts.length !== 3) return null;

  const [typeRaw, marblesRaw, dirRaw] = parts as [string, string, string];

  const typeLower = typeRaw.toLowerCase();
  if (typeLower !== "inline" && typeLower !== "i" && typeLower !== "broadside" && typeLower !== "b") {
    return null;
  }
  const moveType: "inline" | "broadside" =
    typeLower === "inline" || typeLower === "i" ? "inline" : "broadside";

  const marbleStrs = marblesRaw.split("+");
  if (marbleStrs.length < 1 || marbleStrs.length > 3) return null;

  const marbles: AxialCoord[] = [];
  for (const ms of marbleStrs) {
    const m = ms.match(/^(-?\d+),(-?\d+)$/);
    if (!m || m[1] === undefined || m[2] === undefined) return null;
    marbles.push({ q: Number(m[1]), r: Number(m[2]) });
  }

  const dir = DIR_MAP[dirRaw.toLowerCase()];
  if (dir === undefined) return null;

  return { type: moveType, marbles, direction: dir };
};

// ─── Command handler ──────────────────────────────────────────────────────────

export const execute = async (
  interaction: ChatInputCommandInteraction,
  sessionManager: SessionManager,
): Promise<void> => {
  const playerId = PlayerId(interaction.user.id);
  const raw = interaction.options.getString("move", true);

  const move = parseMove(raw);
  if (!move) {
    await interaction.reply({ content: MOVE_FORMAT_HELP, ephemeral: true });
    return;
  }

  // Grab definition before makeMove so we can render even after a FINISHED transition
  const sessionBefore = sessionManager.getSession(interaction.channelId);
  if (!sessionBefore || sessionBefore.phase !== "PLAYING") {
    await interaction.reply({ content: "No game is in progress in this channel.", ephemeral: true });
    return;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const definition = findGame(sessionBefore.gameId) as GameDefinition<any, any, any>;

  const result = sessionManager.makeMove(interaction.channelId, playerId, move);
  if (!result.ok) {
    await interaction.reply({ content: result.error, ephemeral: true });
    return;
  }

  const { session, renderCtx } = result.value;

  const png = (await definition.render(renderCtx)) as Uint8Array;
  const attachment = new AttachmentBuilder(Buffer.from(png), { name: "board.png" });

  // Build status content
  let content: string;
  if (session.phase === "PLAYING") {
    const currentTurn = session.definition.currentTurn(session.state) as string;
    const state = session.state as { capturedBy: Record<string, number> };
    const captureInfo = Object.entries(state.capturedBy)
      .map(([pid, n]) => `<@${pid}>: **${n}** captured`)
      .join("  |  ");
    content = `<@${currentTurn}>'s turn.  ${captureInfo}`;
  } else {
    const { outcome } = session;
    content = outcome.kind === "WIN"
      ? `Game over! <@${outcome.winner}> wins! 🎉`
      : "Game over!";
  }

  // Edit the stored board message in-place, or fall back to a new message
  const storedMessageId = sessionBefore.messageId;
  const channel = interaction.channel;

  if (storedMessageId && channel?.isTextBased()) {
    try {
      const boardMsg = await channel.messages.fetch(storedMessageId);
      await boardMsg.edit({ content, files: [attachment] });
      await interaction.reply({ content: "Move applied.", ephemeral: true });
      return;
    } catch {
      // Fall through to sending a fresh message below
    }
  }

  await interaction.reply({ content, files: [attachment] });
  const msg = await interaction.fetchReply();
  sessionManager.setMessageId(interaction.channelId, msg.id);
};
