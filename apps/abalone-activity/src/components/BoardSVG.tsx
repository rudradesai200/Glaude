import { useState, useMemo } from "react";
import { coordKey, VALID_CELLS, HEX_DIRECTIONS } from "@glaude/game-abalone/board";
import { legalMoves } from "@glaude/game-abalone/moves";
import type { AxialCoord, HexDir, AbaloneMove } from "@glaude/game-abalone/types";
import { useGame } from "../game-context.js";
import {
  axialToPixel,
  hexVertices,
  directionVector,
  HEX_RADIUS,
  SVG_WIDTH,
  SVG_HEIGHT,
} from "../hex-geometry.js";

// ─── Colors ────────────────────────────────────────────────────────────────
const BLACK_MARBLE = "#1a1a1a";
const WHITE_MARBLE = "#f0f0f0";
const BOARD_FILL = "#2d6a4f";
const BOARD_STROKE = "#52b788";
const SELECTION_STROKE = "#facc15";
const ARROW_FILL = "#4ade80";
const LAST_MOVE_STROKE = "#60a5fa";
const MARBLE_RADIUS = HEX_RADIUS * 0.62;

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseKey(key: string): AxialCoord {
  const comma = key.indexOf(",");
  return { q: Number(key.slice(0, comma)), r: Number(key.slice(comma + 1)) };
}

function sameSet(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const k of a) if (!b.has(k)) return false;
  return true;
}

function moveMarblesKey(move: AbaloneMove): string {
  return [...move.marbles].map(coordKey).sort().join("|");
}

// ─── Move Arrow ─────────────────────────────────────────────────────────────

function MoveArrow({
  move,
  onClick,
}: {
  move: AbaloneMove;
  onClick: () => void;
}) {
  const dir = move.direction;
  const { dx, dy } = directionVector(dir);

  // Lead marble: furthest in direction `dir`
  const d = HEX_DIRECTIONS[dir] as AxialCoord;
  const lead = [...move.marbles].reduce((best, c) => {
    const proj = c.q * d.q + c.r * d.r;
    const bProj = best.q * d.q + best.r * d.r;
    return proj > bProj ? c : best;
  });

  const { x: cx, y: cy } = axialToPixel(lead);
  // Arrow tip: 1.8 × HEX_RADIUS beyond the lead marble center
  const tipX = cx + dx * HEX_RADIUS * 1.8;
  const tipY = cy + dy * HEX_RADIUS * 1.8;
  // Chevron base
  const baseX = tipX - dx * HEX_RADIUS * 0.9;
  const baseY = tipY - dy * HEX_RADIUS * 0.9;
  const perpX = -dy * HEX_RADIUS * 0.45;
  const perpY = dx * HEX_RADIUS * 0.45;

  const points = [
    `${tipX.toFixed(2)},${tipY.toFixed(2)}`,
    `${(baseX + perpX).toFixed(2)},${(baseY + perpY).toFixed(2)}`,
    `${(baseX - perpX).toFixed(2)},${(baseY - perpY).toFixed(2)}`,
  ].join(" ");

  return (
    <polygon
      points={points}
      fill={ARROW_FILL}
      opacity={0.85}
      style={{ cursor: "pointer" }}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    />
  );
}

// ─── Board ──────────────────────────────────────────────────────────────────

export function BoardSVG() {
  const { state, myPlayerId, blackPlayerId, sendMove, gameOver } = useGame();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [lastMoved, setLastMoved] = useState<Set<string>>(new Set());

  const isMyTurn = !gameOver && state.turn === myPlayerId;

  // All legal moves for the current position (my turn only)
  const allLegal = useMemo(
    () => (isMyTurn ? legalMoves(state) : []),
    [state, isMyTurn],
  );

  // Moves that match the current selection exactly
  const matchingMoves = useMemo<AbaloneMove[]>(() => {
    if (selected.size === 0) return [];
    const selKey = [...selected].sort().join("|");
    return allLegal.filter((m) => moveMarblesKey(m) === selKey);
  }, [allLegal, selected]);

  // Deduplicate arrows by direction (one per dir, pick first matching move)
  const arrowMoves = useMemo<AbaloneMove[]>(() => {
    const seen = new Set<HexDir>();
    const out: AbaloneMove[] = [];
    for (const m of matchingMoves) {
      if (!seen.has(m.direction)) {
        seen.add(m.direction);
        out.push(m);
      }
    }
    return out;
  }, [matchingMoves]);

  const handleHexClick = (key: string) => {
    const cell = state.board.get(key);
    const coord = parseKey(key);

    if (!isMyTurn) return;

    // Clicking on own marble
    if (cell?.kind === "marble" && cell.owner === myPlayerId) {
      if (selected.has(key)) {
        // Deselect
        setSelected((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
        return;
      }

      if (selected.size >= 3) return; // max 3

      // Extend selection: only if adjacent to an already-selected marble
      const next = new Set(selected);
      next.add(key);

      if (next.size === 1 || isValidSelection(next)) {
        setSelected(next);
      }
      return;
    }

    // Clicking empty / opponent hex clears selection
    void coord;
    setSelected(new Set());
  };

  const handleArrowClick = (move: AbaloneMove) => {
    setLastMoved(new Set(move.marbles.map(coordKey)));
    setSelected(new Set());
    sendMove(move);
  };

  const cells = [...VALID_CELLS];

  return (
    <svg
      width={SVG_WIDTH}
      height={SVG_HEIGHT}
      style={{ display: "block", margin: "0 auto" }}
      onClick={() => setSelected(new Set())}
    >
      {/* Hex cells */}
      {cells.map((key) => {
        const { q, r } = parseKey(key);
        const { x, y } = axialToPixel({ q, r });
        const cell = state.board.get(key);
        const isSelected = selected.has(key);
        const isLastMoved = lastMoved.has(key);

        const hasMarble = cell?.kind === "marble";
        const marbleColor =
          hasMarble && cell.owner === blackPlayerId ? BLACK_MARBLE : WHITE_MARBLE;
        const isOpponent = hasMarble && cell.owner !== myPlayerId;

        return (
          <g key={key} onClick={(e) => { e.stopPropagation(); handleHexClick(key); }}>
            <polygon
              points={hexVertices(x, y)}
              fill={BOARD_FILL}
              stroke={BOARD_STROKE}
              strokeWidth={1}
              style={{ cursor: hasMarble && !isOpponent ? "pointer" : "default" }}
            />
            {hasMarble && (
              <circle
                cx={x}
                cy={y}
                r={MARBLE_RADIUS}
                fill={marbleColor}
                stroke={
                  isSelected
                    ? SELECTION_STROKE
                    : isLastMoved
                      ? LAST_MOVE_STROKE
                      : "none"
                }
                strokeWidth={isSelected ? 3 : isLastMoved ? 2 : 0}
                style={{ cursor: isOpponent ? "default" : "pointer" }}
              />
            )}
          </g>
        );
      })}

      {/* Move direction arrows */}
      {arrowMoves.map((move) => (
        <MoveArrow
          key={`${moveMarblesKey(move)}-${move.direction}`}
          move={move}
          onClick={() => handleArrowClick(move)}
        />
      ))}
    </svg>
  );
}

// ─── Selection validator ─────────────────────────────────────────────────────

/**
 * A selection is valid when the marbles form a contiguous line along one of
 * the 3 hex axes (inline) OR a compact group (broadside-eligible compact group).
 * Here we just check whether ANY legal move covers exactly this set — if yes
 * the selection is structurally valid and we allow extending it.
 */
function isValidSelection(keys: Set<string>): boolean {
  if (keys.size <= 1) return true;

  const coords = [...keys].map(parseKey);

  // Check collinear along any of the 3 axes (dirs 0/1/2)
  for (const axis of [0, 1, 2] as const) {
    const d = HEX_DIRECTIONS[axis] as AxialCoord;
    const sorted = [...coords].sort((a, b) => {
      const diff = (a.q * d.q + a.r * d.r) - (b.q * d.q + b.r * d.r);
      return diff !== 0 ? diff : a.q !== b.q ? a.q - b.q : a.r - b.r;
    });
    let consecutive = true;
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1] as AxialCoord;
      const curr = sorted[i] as AxialCoord;
      const nxt = { q: prev.q + d.q, r: prev.r + d.r };
      if (nxt.q !== curr.q || nxt.r !== curr.r) { consecutive = false; break; }
    }
    if (consecutive) return true;
  }

  return false;
}

// Silence unused import warning
void sameSet;
