import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { PlayerId } from "@glaude/shared";
import type { CoupMove } from "@glaude/game-coup";
import type { CoupStateView } from "@glaude/game-coup";
import { initialState, buildPlayerView } from "@glaude/game-coup";
import type { SdkAuth } from "../discord-sdk.js";

// ─── Game over outcome ────────────────────────────────────────────────────────

export type GameOver = {
  kind: "WIN" | "FORFEIT" | "DRAW";
  winner?: string;
  forfeiter?: string;
};

// ─── Dev fixture IDs ──────────────────────────────────────────────────────────

const DEV_P1 = PlayerId("player1");
const DEV_P2 = PlayerId("player2");
const DEV_P3 = PlayerId("player3");

function devInitialView(myId: PlayerId): CoupStateView {
  const raw = initialState([
    { playerId: DEV_P1, seatIndex: 0 },
    { playerId: DEV_P2, seatIndex: 1 },
    { playerId: DEV_P3, seatIndex: 2 },
  ]);
  return buildPlayerView(raw, myId);
}

// ─── Log entry ────────────────────────────────────────────────────────────────

export type LogEntry = {
  id: number;
  text: string;
};

// ─── Context value ────────────────────────────────────────────────────────────

type CoupContextValue = {
  view: CoupStateView;
  myPlayerId: PlayerId;
  myUsername: string;
  myAvatarUrl: string | null;
  sendMove: (move: CoupMove) => void;
  forfeit: () => void;
  connected: boolean;
  gameOver: GameOver | null;
  log: readonly LogEntry[];
};

const CoupContext = createContext<CoupContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function CoupProvider({ auth, children }: { auth: SdkAuth; children: ReactNode }) {
  const envWsUrl = import.meta.env["VITE_WS_URL"] as string | undefined;
  const { userId, username, avatarUrl, sessionId, wsUrl: authWsUrl } = auth;
  const wsUrl = authWsUrl ?? envWsUrl;

  const useWs = Boolean(wsUrl && sessionId && userId);
  const myPlayerId = PlayerId(userId);

  const [view, setView] = useState<CoupStateView>(() => devInitialView(myPlayerId));
  const [connected, setConnected] = useState(!useWs);
  const [gameOver, setGameOver] = useState<GameOver | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const logCounter = useRef(0);

  const wsRef = useRef<WebSocket | null>(null);

  const addLog = (text: string) => {
    setLog((prev) => [...prev.slice(-49), { id: logCounter.current++, text }]);
  };

  useEffect(() => {
    if (!useWs || !wsUrl || !sessionId || !userId) return;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "join", sessionId, userId, username }));
      setConnected(true);
    };

    ws.onmessage = (evt: MessageEvent<string>) => {
      const msg = JSON.parse(evt.data) as
        | { type: "state"; state: CoupStateView; gameId: string }
        | { type: "ended"; outcome: GameOver; state?: CoupStateView }
        | { type: "error"; message: string };

      if (msg.type === "state") {
        setView(msg.state);
        setGameOver(null);
        addLog(describePhase(msg.state));
      } else if (msg.type === "ended") {
        if (msg.state) setView(msg.state);
        setGameOver(msg.outcome);
        const winner = msg.outcome.winner;
        addLog(winner ? `Game over — winner: ${winner}` : "Game over — draw");
      } else {
        console.error("[coup ws error]", msg.message);
      }
    };

    ws.onerror = (e) => console.error("[coup ws] error:", e);
    ws.onclose = () => setConnected(false);

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [useWs, wsUrl, sessionId, userId]);

  const sendMove = (move: CoupMove) => {
    if (gameOver) return;
    if (useWs && wsRef.current?.readyState === WebSocket.OPEN && sessionId && userId) {
      wsRef.current.send(JSON.stringify({ type: "move", sessionId, userId, move }));
    }
  };

  const forfeit = () => {
    if (gameOver) return;
    if (useWs && wsRef.current?.readyState === WebSocket.OPEN && sessionId && userId) {
      wsRef.current.send(JSON.stringify({ type: "forfeit", sessionId, userId }));
    }
  };

  return (
    <CoupContext.Provider
      value={{ view, myPlayerId, myUsername: username, myAvatarUrl: avatarUrl, sendMove, forfeit, connected, gameOver, log }}
    >
      {children}
    </CoupContext.Provider>
  );
}

export function useCoup(): CoupContextValue {
  const ctx = useContext(CoupContext);
  if (!ctx) throw new Error("useCoup must be used inside <CoupProvider>");
  return ctx;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function describePhase(view: CoupStateView): string {
  const p = view.pendingAction;
  switch (view.phase) {
    case "ACTION":
      return `Turn: player ${view.turnOrder[view.turnIndex]}`;
    case "AWAIT_CHALLENGE_BLOCK":
      return `${p?.actor} declared ${p?.action} — waiting for responses`;
    case "AWAIT_BLOCK_CHALLENGE":
      return `${p?.blocker} blocked with ${p?.blockedCard} — actor may challenge`;
    case "AWAIT_REVEAL":
      return `${p?.target} must reveal an influence`;
    case "AWAIT_EXCHANGE":
      return `${p?.actor} is exchanging cards`;
    default:
      return "";
  }
}
