import type { AxialCoord, HexDir } from "@glaude/game-abalone/types";
import { HEX_DIRECTIONS } from "@glaude/game-abalone/board";

export const HEX_RADIUS = 32; // px, flat-top

/** SVG canvas dimensions and center */
export const SVG_WIDTH = 560;
export const SVG_HEIGHT = 600;
export const CX = SVG_WIDTH / 2;
export const CY = SVG_HEIGHT / 2;

/** Axial → pixel (flat-top layout) */
export function axialToPixel(coord: AxialCoord): { x: number; y: number } {
  const { q, r } = coord;
  return {
    x: CX + HEX_RADIUS * 1.5 * q,
    y: CY + HEX_RADIUS * Math.sqrt(3) * (r + q / 2),
  };
}

/** Six vertices of a flat-top hexagon centered at (cx, cy) */
export function hexVertices(cx: number, cy: number, radius = HEX_RADIUS): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i);
    pts.push(`${(cx + radius * Math.cos(angle)).toFixed(2)},${(cy + radius * Math.sin(angle)).toFixed(2)}`);
  }
  return pts.join(" ");
}

/** Pixel direction unit vector for a given HexDir */
export function directionVector(dir: HexDir): { dx: number; dy: number } {
  const d = HEX_DIRECTIONS[dir] as AxialCoord;
  const px = 1.5 * d.q;
  const py = Math.sqrt(3) * (d.r + d.q / 2);
  const mag = Math.sqrt(px * px + py * py);
  return { dx: px / mag, dy: py / mag };
}
