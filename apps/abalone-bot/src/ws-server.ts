import { WebSocketServer, WebSocket } from "ws";
import { PlayerId } from "@glaude/shared";
import type { SessionManager, PlayingSession, EndedSession } from "./session-manager.js";

// ─── Wire types ────────────────────────────────────────────────────────────────

type ClientToServer =
  | { readonly type: "join"; readonly sessionId: string; readonly userId: string; readonly username: string }
  | { readonly type: "move"; readonly sessionId: string; readonly userId: string; readonly move: unknown }
  | { readonly type: "forfeit"; readonly sessionId: string; readonly userId: string };

type WireOutcome = { kind: string; winner?: string; forfeiter?: string };

type ServerToClient =
  | { readonly type: "state"; readonly state: unknown; readonly gameId: string }
  | { readonly type: "ended"; readonly outcome: WireOutcome; readonly state?: unknown }
  | { readonly type: "error"; readonly message: string };

// ─── Helpers ───────────────────────────────────────────────────────────────────

function wireOutcome(outcome: EndedSession["outcome"]): WireOutcome {
  if (outcome.kind === "WIN") return { kind: "WIN", winner: outcome.winner };
  if (outcome.kind === "FORFEIT") return { kind: "FORFEIT", winner: outcome.winner, forfeiter: outcome.forfeiter };
  return { kind: "DRAW" };
}

function send(ws: WebSocket, msg: ServerToClient): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

/**
 * Build the wire-ready state payload for a specific observer.
 * Uses buildPlayerView when the game defines it (per-player masking),
 * otherwise falls back to serializeState (broadcast-safe generic payload).
 */
function playerStatePayload(session: PlayingSession, playerId: PlayerId): unknown {
  const { definition, state, seats } = session;
  if (definition.buildPlayerView) {
    return definition.buildPlayerView(state, playerId, seats);
  }
  return JSON.parse(definition.serializeState(state as never));
}

// ─── Server ────────────────────────────────────────────────────────────────────

// How long to wait after all players disconnect before auto-forfeiting (ms).
const DISCONNECT_FORFEIT_DELAY_MS = 30_000;
// How long to wait before auto-passing non-respondents in multi-response phases (ms).
const AUTO_PASS_DELAY_MS = 15_000;

export function startWsServer(sessions: SessionManager): WebSocketServer {
  const port = Number(process.env["WS_PORT"] ?? 3001);

  // sessionId → Set of connected sockets
  const rooms = new Map<string, Set<WebSocket>>();
  // socket → { sessionId, userId, username } — populated on "join"
  const socketPlayers = new Map<WebSocket, { sessionId: string; userId: string; username: string }>();
  // sessionId → pending auto-forfeit timer
  const disconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();
  // sessionId → pending auto-PASS timer (for multi-response phases)
  const autoPassTimers = new Map<string, ReturnType<typeof setTimeout>>();

  const join = (ws: WebSocket, sessionId: string, userId: string, username: string) => {
    // Cancel any pending auto-forfeit timer when a player rejoins.
    const pending = disconnectTimers.get(sessionId);
    if (pending !== undefined) {
      clearTimeout(pending);
      disconnectTimers.delete(sessionId);
      console.log("[ws] reconnect — cancelled auto-forfeit timer for", sessionId);
    }

    let room = rooms.get(sessionId);
    if (!room) {
      room = new Set();
      rooms.set(sessionId, room);
    }
    room.add(ws);
    socketPlayers.set(ws, { sessionId, userId, username });
  };

  const leave = (ws: WebSocket) => {
    const player = socketPlayers.get(ws);
    socketPlayers.delete(ws);

    for (const [id, room] of rooms) {
      room.delete(ws);
      if (room.size === 0) rooms.delete(id);
    }

    // Start auto-forfeit timer if the room is now empty and the game is still running.
    if (player) {
      const { sessionId, userId } = player;
      const room = rooms.get(sessionId);
      const session = sessions.getSession(sessionId);
      if ((!room || room.size === 0) && session?.phase === "PLAYING") {
        console.log(`[ws] room empty — scheduling auto-forfeit for ${sessionId} in ${DISCONNECT_FORFEIT_DELAY_MS}ms`);
        const timer = setTimeout(() => {
          disconnectTimers.delete(sessionId);
          const result = sessions.forfeit(sessionId, PlayerId(userId));
          if (result.ok) {
            console.log(`[ws] auto-forfeit triggered for ${sessionId} — forfeiter: ${userId}`);
            const finalRoom = rooms.get(sessionId);
            if (finalRoom) {
              const payload = JSON.stringify({
                type: "ended",
                outcome: wireOutcome(result.value.outcome),
              } satisfies ServerToClient);
              for (const client of finalRoom) {
                if (client.readyState === WebSocket.OPEN) client.send(payload);
              }
            }
          }
        }, DISCONNECT_FORFEIT_DELAY_MS);
        disconnectTimers.set(sessionId, timer);
      }
    }
  };

  /**
   * Send each socket in the room its own view of the state.
   * Falls back to a shared broadcast when buildPlayerView is not defined.
   * Also schedules auto-PASS timers for multi-response phases.
   */
  const broadcastState = (sessionId: string, session: PlayingSession) => {
    const room = rooms.get(sessionId);
    if (!room) return;

    const { definition } = session;

    const gameId = session.definition.id as string;

    if (definition.buildPlayerView) {
      // Per-player masked views
      for (const client of room) {
        if (client.readyState !== WebSocket.OPEN) continue;
        const info = socketPlayers.get(client);
        if (!info) continue;
        const view = playerStatePayload(session, PlayerId(info.userId));
        client.send(JSON.stringify({ type: "state", state: view, gameId } satisfies ServerToClient));
      }
    } else {
      // Generic broadcast — same payload for everyone
      const state = JSON.parse(definition.serializeState(session.state as never));
      const payload = JSON.stringify({ type: "state", state, gameId } satisfies ServerToClient);
      for (const client of room) {
        if (client.readyState === WebSocket.OPEN) client.send(payload);
      }
    }

    scheduleAutoPass(sessionId, session);
  };

  const broadcastEnded = (sessionId: string, msg: ServerToClient) => {
    const room = rooms.get(sessionId);
    if (!room) return;
    const payload = JSON.stringify(msg);
    for (const client of room) {
      if (client.readyState === WebSocket.OPEN) client.send(payload);
    }
  };

  const cancelAutoPass = (sessionId: string) => {
    const t = autoPassTimers.get(sessionId);
    if (t !== undefined) {
      clearTimeout(t);
      autoPassTimers.delete(sessionId);
    }
  };

  /**
   * Schedule auto-PASS moves for all active respondents after AUTO_PASS_DELAY_MS.
   * Only runs when the game defines activeRespondents (i.e. Coup multi-response phases).
   * Abalone has no activeRespondents, so this is a no-op for it.
   */
  const scheduleAutoPass = (sessionId: string, session: PlayingSession) => {
    if (!session.definition.activeRespondents) return;

    cancelAutoPass(sessionId);

    const respondents = session.definition.activeRespondents(session.state);
    if (respondents.length === 0) return;

    const timer = setTimeout(() => {
      autoPassTimers.delete(sessionId);
      const current = sessions.getSession(sessionId);
      if (current?.phase !== "PLAYING") return;

      const pass: unknown = { kind: "PASS" };
      const pending = current.definition.activeRespondents
        ? current.definition.activeRespondents(current.state)
        : [];

      console.log(`[ws] auto-PASS timer fired for ${sessionId} — respondents: ${pending.join(", ")}`);

      for (const playerId of pending) {
        const r = sessions.getSession(sessionId);
        if (r?.phase !== "PLAYING") break;
        // Re-check this player still has a legal PASS before applying
        const legal = r.definition.legalMoves(r.state, playerId);
        const canPass = legal.some((m) => (m as { kind: string }).kind === "PASS");
        if (!canPass) continue;
        const moveResult = sessions.makeMove(sessionId, playerId, pass);
        if (moveResult.ok) {
          const { session: updated } = moveResult.value;
          if (updated.phase === "PLAYING") {
            broadcastState(sessionId, updated as PlayingSession);
          } else {
            broadcastEnded(sessionId, {
              type: "ended",
              outcome: wireOutcome((updated as EndedSession).outcome),
            });
            return;
          }
        }
      }
    }, AUTO_PASS_DELAY_MS);

    autoPassTimers.set(sessionId, timer);
  };

  const wss = new WebSocketServer({ port });

  wss.on("connection", (ws) => {
    console.log("[ws] new connection");
    ws.on("close", () => { console.log("[ws] connection closed"); leave(ws); });

    ws.on("message", (raw) => {
      let msg: ClientToServer;
      try {
        msg = JSON.parse(raw.toString()) as ClientToServer;
      } catch {
        send(ws, { type: "error", message: "Invalid JSON" });
        return;
      }

      if (msg.type === "join") {
        console.log("[ws] join — channelId:", msg.sessionId, "userId:", msg.userId);

        // Determine gameId: use existing session's game if present, else default to abalone.
        const existing = sessions.getSession(msg.sessionId);
        const gameId = existing?.gameId ?? "abalone";

        const result = sessions.autoJoin(msg.sessionId, gameId, PlayerId(msg.userId), msg.username);
        if (!result.ok) {
          send(ws, { type: "error", message: result.error });
          return;
        }
        const session = result.value;
        console.log("[ws] session phase:", session.phase);
        join(ws, msg.sessionId, msg.userId, msg.username);

        if (session.phase === "PLAYING") {
          // Broadcast to everyone in the room — the last joiner just started the game.
          broadcastState(msg.sessionId, session as PlayingSession);
        } else {
          // LOBBY: auto-join any other sockets already in the room so the game
          // starts immediately without requiring the opponent to click "New Game".
          const room = rooms.get(msg.sessionId);
          if (room) {
            for (const otherWs of room) {
              if (otherWs === ws) continue;
              const other = socketPlayers.get(otherWs);
              if (!other) continue;
              const otherResult = sessions.autoJoin(msg.sessionId, gameId, PlayerId(other.userId), other.username);
              if (otherResult.ok && otherResult.value.phase === "PLAYING") {
                const playingSession = otherResult.value as PlayingSession;
                console.log("[ws] auto-joined opponent for new game:", other.userId);
                broadcastState(msg.sessionId, playingSession);
                break;
              }
            }
          }
        }
        return;
      }

      if (msg.type === "move") {
        console.log("[ws] move — channelId:", msg.sessionId, "userId:", msg.userId);

        // Cancel any pending auto-PASS timer — a real move is coming in.
        cancelAutoPass(msg.sessionId);

        // Authorization check: use activeRespondents when the game defines it.
        const currentSession = sessions.getSession(msg.sessionId);
        if (currentSession?.phase === "PLAYING") {
          const { definition, state } = currentSession;
          const allowed: readonly PlayerId[] = definition.activeRespondents
            ? definition.activeRespondents(state)
            : [definition.currentTurn(state)];
          if (!allowed.includes(PlayerId(msg.userId))) {
            send(ws, { type: "error", message: "It is not your turn" });
            return;
          }
        }

        const result = sessions.makeMove(msg.sessionId, PlayerId(msg.userId), msg.move);
        if (!result.ok) {
          send(ws, { type: "error", message: result.error });
          return;
        }
        const { session: updatedSession } = result.value;
        if (updatedSession.phase === "PLAYING") {
          broadcastState(msg.sessionId, updatedSession as PlayingSession);
        } else {
          const endedSession = updatedSession as EndedSession;
          broadcastEnded(msg.sessionId, {
            type: "ended",
            outcome: wireOutcome(endedSession.outcome),
          });
        }
        return;
      }

      if (msg.type === "forfeit") {
        console.log("[ws] forfeit — channelId:", msg.sessionId, "userId:", msg.userId);
        cancelAutoPass(msg.sessionId);
        const result = sessions.forfeit(msg.sessionId, PlayerId(msg.userId));
        if (!result.ok) {
          send(ws, { type: "error", message: result.error });
          return;
        }
        broadcastEnded(msg.sessionId, {
          type: "ended",
          outcome: wireOutcome(result.value.outcome),
        });
        return;
      }
    });
  });

  wss.on("listening", () => {
    console.log(`Glaude WS server listening on ws://localhost:${port}`);
  });

  return wss;
}
