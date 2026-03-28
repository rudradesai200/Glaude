import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { PlayerId } from "@glaude/shared";
import { initialState } from "@glaude/game-abalone/board";
import type { AbaloneState, AbaloneMove, Cell } from "@glaude/game-abalone/types";
import { applyMove, validateMove, isWon } from "@glaude/game-abalone/moves";
import { isOk } from "@glaude/shared";
import type { SdkAuth } from "./discord-sdk.js";

// ─── Dev fixtures ──────────────────────────────────────────────────────────────
export const BLACK_ID = PlayerId("player1");
export const WHITE_ID = PlayerId("player2");

// ─── Game over outcome (wire format) ──────────────────────────────────────────

export type GameOver = {
  kind: "WIN" | "FORFEIT" | "DRAW";
  winner?: string;
  forfeiter?: string;
};

// ─── State deserialization ─────────────────────────────────────────────────────

type RawState = {
  board: Record<string, Cell>;
  turn: string;
  capturedBy: Record<string, number>;
  moveNumber: number;
  players?: [string, string];
};

function deserializeState(raw: RawState): AbaloneState {
  return {
    board: new Map(Object.entries(raw.board)),
    turn: PlayerId(raw.turn),
    capturedBy: raw.capturedBy,
    moveNumber: raw.moveNumber,
  };
}

// ─── Context ───────────────────────────────────────────────────────────────────

type GameContextValue = {
  state: AbaloneState;
  myPlayerId: PlayerId;
  opponentId: PlayerId;
  blackPlayerId: PlayerId;
  myUsername: string;
  myAvatarUrl: string | null;
  sendMove: (move: AbaloneMove) => void;
  forfeit: () => void;
  startNewGame: () => void;
  connected: boolean;
  gameOver: GameOver | null;
};

const GameContext = createContext<GameContextValue | null>(null);

// ─── Provider ──────────────────────────────────────────────────────────────────

export function GameProvider({ auth, children }: { auth: SdkAuth; children: ReactNode }) {
  const envWsUrl = import.meta.env["VITE_WS_URL"] as string | undefined;
  const { userId, username, avatarUrl, sessionId, wsUrl: authWsUrl } = auth;
  const wsUrl = authWsUrl ?? envWsUrl;
  console.log("[game-context] userId:", userId, "sessionId:", sessionId, "wsUrl:", wsUrl, "useWs:", Boolean(wsUrl && sessionId && userId));

  const useWs = Boolean(wsUrl && sessionId && userId);

  const myPlayerId = PlayerId(userId);

  const [state, setState] = useState<AbaloneState>(() =>
    initialState(BLACK_ID, WHITE_ID),
  );
  // players[0] = black (seat 0), players[1] = white (seat 1)
  const [players, setPlayers] = useState<[PlayerId, PlayerId]>([BLACK_ID, WHITE_ID]);
  const blackPlayerId = players[0];
  const opponentId = players[0] === myPlayerId ? players[1] : players[0];
  const [connected, setConnected] = useState(!useWs);
  const [gameOver, setGameOver] = useState<GameOver | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  // Dev cross-tab sync via BroadcastChannel (no WS, no sessionId)
  const bcRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    if (useWs) return;
    const bc = new BroadcastChannel("glaude-dev");
    bcRef.current = bc;
    bc.onmessage = (evt: MessageEvent<RawState | { type: "game-over"; outcome: GameOver | null }>) => {
      const data = evt.data;
      if ("type" in data && data.type === "game-over") {
        setGameOver(data.outcome);
      } else {
        const raw = data as RawState;
        setState(deserializeState(raw));
        if (raw.players) setPlayers([PlayerId(raw.players[0]), PlayerId(raw.players[1])]);
      }
    };
    return () => {
      bc.close();
      bcRef.current = null;
    };
  }, [useWs]);

  useEffect(() => {
    if (!useWs || !wsUrl || !sessionId || !userId) return;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[ws] connected, joining sessionId:", sessionId, "userId:", userId);
      ws.send(JSON.stringify({ type: "join", sessionId, userId, username }));
      setConnected(true);
    };

    ws.onmessage = (evt: MessageEvent<string>) => {
      const msg = JSON.parse(evt.data) as
        | { type: "state"; state: RawState }
        | { type: "ended"; outcome: GameOver; state?: RawState }
        | { type: "error"; message: string };

      if (msg.type === "state") {
        setState(deserializeState(msg.state));
        if (msg.state.players) setPlayers([PlayerId(msg.state.players[0]), PlayerId(msg.state.players[1])]);
        setGameOver(null);
      } else if (msg.type === "ended") {
        if (msg.state) {
          setState(deserializeState(msg.state));
          if (msg.state.players) setPlayers([PlayerId(msg.state.players[0]), PlayerId(msg.state.players[1])]);
        }
        setGameOver(msg.outcome);
      } else {
        console.error("[WS error]", msg.message);
      }
    };

    ws.onerror = (e) => console.error("[ws] error:", e);
    ws.onclose = (e) => { console.log("[ws] closed:", e.code, e.reason); setConnected(false); };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [useWs, wsUrl, sessionId, userId]);

  const sendMove = (move: AbaloneMove) => {
    if (gameOver) return;

    if (useWs && wsRef.current?.readyState === WebSocket.OPEN && sessionId && userId) {
      wsRef.current.send(JSON.stringify({ type: "move", sessionId, userId, move }));
    } else {
      // Local fallback (dev / no WS) — sync across tabs via BroadcastChannel
      const validation = validateMove(state, move);
      if (isOk(validation)) {
        const next = applyMove(state, move);
        setState(next);
        const raw: RawState = {
          board: Object.fromEntries(next.board),
          turn: next.turn,
          capturedBy: { ...next.capturedBy },
          moveNumber: next.moveNumber,
        };
        bcRef.current?.postMessage(raw);

        // Check for win after applying the move locally
        const winner = isWon(next);
        if (winner) {
          const outcome: GameOver = { kind: "WIN", winner };
          setGameOver(outcome);
          bcRef.current?.postMessage({ type: "game-over", outcome });
        }
      }
    }
  };

  const forfeit = () => {
    if (gameOver) return;

    if (useWs && wsRef.current?.readyState === WebSocket.OPEN && sessionId && userId) {
      wsRef.current.send(JSON.stringify({ type: "forfeit", sessionId, userId }));
    } else {
      // Local dev forfeit — immediately end the game
      const outcome: GameOver = { kind: "FORFEIT", winner: opponentId, forfeiter: myPlayerId };
      setGameOver(outcome);
      bcRef.current?.postMessage({ type: "game-over", outcome });
    }
  };

  const startNewGame = () => {
    if (useWs && wsRef.current?.readyState === WebSocket.OPEN && sessionId && userId) {
      // Re-send join — autoJoin will create a new lobby since session is ended.
      // When both players do this, server transitions to PLAYING and broadcasts state.
      wsRef.current.send(JSON.stringify({ type: "join", sessionId, userId, username }));
      // Clear the overlay immediately so the button feels responsive.
      // The server will broadcast the real initial state once both players have joined.
      setGameOver(null);
    } else {
      // Dev mode: reset locally and broadcast to other tabs
      const next = initialState(BLACK_ID, WHITE_ID);
      setState(next);
      setGameOver(null);
      const raw: RawState = {
        board: Object.fromEntries(next.board),
        turn: next.turn,
        capturedBy: { ...next.capturedBy },
        moveNumber: next.moveNumber,
      };
      bcRef.current?.postMessage(raw);
      bcRef.current?.postMessage({ type: "game-over", outcome: null });
    }
  };

  return (
    <GameContext.Provider
      value={{ state, myPlayerId, opponentId, blackPlayerId, myUsername: username, myAvatarUrl: avatarUrl, sendMove, forfeit, startNewGame, connected, gameOver }}
    >
      {children}
    </GameContext.Provider>
  );
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be used inside <GameProvider>");
  return ctx;
}
