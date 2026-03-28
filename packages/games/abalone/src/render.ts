import { createCanvas, type SKRSContext2D } from "@napi-rs/canvas";
import { VALID_CELLS, parseKey } from "./board.js";
import type { AbaloneRenderContext } from "./types.js";

const HEX_RADIUS = 34;
const CANVAS_SIZE = 640;
const CENTER_X = CANVAS_SIZE / 2;
const CENTER_Y = CANVAS_SIZE / 2;

const COLORS = {
  background: "#2d6a4f",
  cell: "#52b788",
  cellStroke: "#1b4332",
  marbleBlack: "#1a1a1a",
  marbleWhite: "#f0f0f0",
  marbleStroke: "#888888",
  label: "#ffffff",
} as const;

/** Axial → pixel (flat-top hex) */
const axialToPixel = (q: number, r: number): { x: number; y: number } => ({
  x: CENTER_X + HEX_RADIUS * 1.5 * q,
  y: CENTER_Y + HEX_RADIUS * Math.sqrt(3) * (r + q / 2),
});

/** Draw a flat-top hexagon centered at (cx, cy) */
const drawHex = (
  ctx: SKRSContext2D,
  cx: number,
  cy: number,
  r: number,
): void => {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i; // flat-top: 0° = right
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
};

export const renderAbalone = async (ctx: AbaloneRenderContext): Promise<Uint8Array> => {
  const canvas = createCanvas(CANVAS_SIZE, CANVAS_SIZE);
  const c = canvas.getContext("2d");

  // Build playerId → color map
  const playerColor = new Map<string, string>();
  for (const seat of ctx.players) {
    playerColor.set(seat.playerId, seat.seatIndex === 0 ? COLORS.marbleBlack : COLORS.marbleWhite);
  }

  // Background
  c.fillStyle = COLORS.background;
  c.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  const innerR = HEX_RADIUS - 2; // slight inset for stroke gap

  // Draw all 61 cells
  for (const key of VALID_CELLS) {
    const { q, r } = parseKey(key);
    const { x, y } = axialToPixel(q, r);

    // Hex cell background
    drawHex(c, x, y, innerR);
    c.fillStyle = COLORS.cell;
    c.fill();
    c.strokeStyle = COLORS.cellStroke;
    c.lineWidth = 1.5;
    c.stroke();

    // Marble (if present)
    const cell = ctx.state.board.get(key);
    if (cell?.kind === "marble") {
      const color = playerColor.get(cell.owner) ?? "#888888";
      c.beginPath();
      c.arc(x, y, innerR * 0.62, 0, Math.PI * 2);
      c.fillStyle = color;
      c.fill();
      c.strokeStyle = COLORS.marbleStroke;
      c.lineWidth = 1.5;
      c.stroke();
    }

    // Axial coordinate label
    c.fillStyle = COLORS.label;
    c.font = `${Math.round(HEX_RADIUS * 0.28)}px sans-serif`;
    c.textAlign = "center";
    c.textBaseline = "bottom";
    c.globalAlpha = 0.55;
    c.fillText(`${q},${r}`, x, y + innerR * 0.9);
    c.globalAlpha = 1;
  }

  return canvas.encode("png");
};
