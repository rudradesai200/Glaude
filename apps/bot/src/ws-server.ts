import { WebSocketServer, WebSocket } from "ws";
import { PlayerId } from "@glaude/shared";
import type { SessionManager, PlayingSession, EndedSession } from "./session-manager.js";
import type { AbaloneMove, AbaloneState, Cell } from "@glaude/game-abalone/types";

// ─── Wire types ────────────────────────────────────────────────────────────────

type ClientToServer =
  | { readonly type: "join"; readonly sessionId: string; readonly userId: string; readonly username: string }
  | { readonly type: "move"; readonly sessionId: string; readonly userId: string; readonly move: AbaloneMove }
  | { readonly type: "forfeit"; readonly sessionId: string; readonly userId: string };

type SerializedState = {
  board: Record<string, Cell>;
  turn: string;
  capturedBy: Record<string, number>;
  moveNumber: number;
  // players[0] = black (seat 0, moves first), players[1] = white (seat 1)
  players: [string, string];
};

type WireOutcome = { kind: string; winner?: string; forfeiter?: string };

type ServerToClient =
  | { readonly type: "state"; readonly state: SerializedState }
  | { readonly type: "ended"; readonly outcome: WireOutcome; readonly state?: SerializedState }
  | { readonly type: "error"; readonly message: string };

// ─── Helpers ───────────────────────────────────────────────────────────────────

function serializeState(state: AbaloneState, session: PlayingSession): SerializedState {
  const sorted = session.seats.slice().sort((a, b) => a.seatIndex - b.seatIndex);
  return {
    board: Object.fromEntries(state.board),
    turn: state.turn,
    capturedBy: { ...state.capturedBy },
    moveNumber: state.moveNumber,
    players: [sorted[0]!.playerId, sorted[1]!.playerId],
  };
}

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

// ─── Server ────────────────────────────────────────────────────────────────────

// How long to wait after both players disconnect before auto-forfeiting (ms).
const DISCONNECT_FORFEIT_DELAY_MS = 30_000;

export function startWsServer(sessions: SessionManager): WebSocketServer {
  const port = Number(process.env["WS_PORT"] ?? 3001);

  // sessionId → Set of connected sockets
  const rooms = new Map<string, Set<WebSocket>>();
  // socket → { sessionId, userId, username } — populated on "join"
  const socketPlayers = new Map<WebSocket, { sessionId: string; userId: string; username: string }>();
  // sessionId → pending auto-forfeit timer
  const disconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();

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
            // Broadcast to anyone who may have reconnected between timer start and now.
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

  const broadcast = (sessionId: string, msg: ServerToClient) => {
    const room = rooms.get(sessionId);
    if (!room) return;
    const payload = JSON.stringify(msg);
    for (const client of room) {
      if (client.readyState === WebSocket.OPEN) client.send(payload);
    }
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
        const result = sessions.autoJoin(msg.sessionId, "abalone", PlayerId(msg.userId), msg.username);
        if (!result.ok) {
          send(ws, { type: "error", message: result.error });
          return;
        }
        const session = result.value;
        console.log("[ws] session phase:", session.phase);
        join(ws, msg.sessionId, msg.userId, msg.username);

        if (session.phase === "PLAYING") {
          // Broadcast to everyone in the room — the 2nd joiner just started the game.
          broadcast(msg.sessionId, { type: "state", state: serializeState(session.state as AbaloneState, session as PlayingSession) });
        } else {
          // LOBBY: auto-join any other sockets already in the room so the game
          // starts immediately without requiring the opponent to click "New Game".
          const room = rooms.get(msg.sessionId);
          if (room) {
            for (const otherWs of room) {
              if (otherWs === ws) continue;
              const other = socketPlayers.get(otherWs);
              if (!other) continue;
              const otherResult = sessions.autoJoin(msg.sessionId, "abalone", PlayerId(other.userId), other.username);
              if (otherResult.ok && otherResult.value.phase === "PLAYING") {
                const playingSession = otherResult.value as PlayingSession;
                console.log("[ws] auto-joined opponent for new game:", other.userId);
                broadcast(msg.sessionId, { type: "state", state: serializeState(playingSession.state as AbaloneState, playingSession) });
                break;
              }
            }
          }
        }
        return;
      }

      if (msg.type === "move") {
        console.log("[ws] move — channelId:", msg.sessionId, "userId:", msg.userId);
        const result = sessions.makeMove(msg.sessionId, PlayerId(msg.userId), msg.move);
        if (!result.ok) {
          send(ws, { type: "error", message: result.error });
          return;
        }
        const { session: updatedSession, renderCtx } = result.value;
        if (updatedSession.phase === "PLAYING") {
          const playingSession = updatedSession as PlayingSession;
          broadcast(msg.sessionId, {
            type: "state",
            state: serializeState(playingSession.state as AbaloneState, playingSession),
          });
        } else {
          // Game finished via normal win — broadcast final state + outcome together.
          // Reconstruct a temporary PlayingSession to get seats for serialization.
          const endedSession = updatedSession as EndedSession;
          const finalState = (renderCtx as { state: AbaloneState }).state;
          const tempSession = { seats: endedSession.seats } as PlayingSession;
          broadcast(msg.sessionId, {
            type: "ended",
            outcome: wireOutcome(endedSession.outcome),
            state: serializeState(finalState, tempSession),
          });
        }
        return;
      }

      if (msg.type === "forfeit") {
        console.log("[ws] forfeit — channelId:", msg.sessionId, "userId:", msg.userId);
        const result = sessions.forfeit(msg.sessionId, PlayerId(msg.userId));
        if (!result.ok) {
          send(ws, { type: "error", message: result.error });
          return;
        }
        broadcast(msg.sessionId, {
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
