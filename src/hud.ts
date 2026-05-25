/**
 * Wind indicator HUD — Windex 15 viewed from below (cockpit perspective).
 * Minimal: rotating vane + two fixed close-hauled reference arms.
 * Bow is at top (looking up and forward from cockpit).
 */

const SIZE = 130;
const HALF = SIZE / 2;

let canvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;

export function createWindHUD(): HTMLCanvasElement {
  canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  canvas.style.position = 'fixed';
  canvas.style.top = '16px';
  canvas.style.left = '16px';
  canvas.style.pointerEvents = 'none';
  document.body.appendChild(canvas);
  ctx = canvas.getContext('2d')!;
  return canvas;
}

export function updateWindHUD(windAngle: number): void {
  ctx.clearRect(0, 0, SIZE, SIZE);

  // Faint sky-circle background
  ctx.beginPath();
  ctx.arc(HALF, HALF, HALF - 2, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(135, 190, 220, 0.15)';
  ctx.fill();

  // ── Fixed reference arms (close-hauled boundaries) ──────────
  // Windex 15 has two arms at ~45° from centerline with small balls at tips
  const refAngle = Math.PI / 6; // 30° — matches NO_GO_ZONE
  const refLen = HALF - 12;
  const ballR = 3.5;

  const col = 'rgba(0, 0, 0, 0.7)';

  ctx.strokeStyle = col;
  ctx.lineWidth = 1.5;

  // Port reference arm (upper-left from center)
  const portArmAngle = -Math.PI / 2 - refAngle;
  const portTipX = HALF + Math.cos(portArmAngle) * refLen;
  const portTipY = HALF + Math.sin(portArmAngle) * refLen;
  ctx.beginPath();
  ctx.moveTo(HALF, HALF);
  ctx.lineTo(portTipX, portTipY);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(portTipX, portTipY, ballR, 0, Math.PI * 2);
  ctx.fillStyle = col;
  ctx.fill();

  // Starboard reference arm (upper-right from center)
  const stbdArmAngle = -Math.PI / 2 + refAngle;
  const stbdTipX = HALF + Math.cos(stbdArmAngle) * refLen;
  const stbdTipY = HALF + Math.sin(stbdArmAngle) * refLen;
  ctx.beginPath();
  ctx.moveTo(HALF, HALF);
  ctx.lineTo(stbdTipX, stbdTipY);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(stbdTipX, stbdTipY, ballR, 0, Math.PI * 2);
  ctx.fillStyle = col;
  ctx.fill();

  // ── Rotating vane ───────────────────────────────────────────
  // Arrow points downwind; tail (fins) faces into the wind
  // From below, port/starboard are mirrored so we negate windAngle on X
  const vaneAngle = Math.PI / 2 + windAngle;
  const vx = Math.cos(vaneAngle);
  const vy = Math.sin(vaneAngle);
  const px = -vy; // perpendicular
  const py = vx;

  const pointerLen = 32;  // points downwind
  const tailLen = 30;     // shaft into the wind

  const tipX = HALF + vx * pointerLen;
  const tipY = HALF + vy * pointerLen;
  const tailX = HALF - vx * tailLen;
  const tailY = HALF - vy * tailLen;

  // Vane: pointy nose → straight shaft → wider triangle tail
  const shaftW = 1.5;   // half-width of the straight section
  const triW = 7;        // half-width of the tail triangle
  const triStart = 10;   // where the triangle begins (distance from center toward tail)

  const triSX = HALF - vx * triStart; // triangle start point
  const triSY = HALF - vy * triStart;

  const headW = 5;        // half-width of arrowhead barbs
  const headBack = 8;     // how far back the barbs extend from tip

  ctx.beginPath();
  // Arrowhead
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(tipX - vx * headBack + px * headW, tipY - vy * headBack + py * headW);
  ctx.lineTo(tipX - vx * headBack + px * shaftW, tipY - vy * headBack + py * shaftW);
  // Down to shaft (starboard edge)
  ctx.lineTo(HALF + vx * 6 + px * shaftW, HALF + vy * 6 + py * shaftW);
  // Straight shaft to triangle start
  ctx.lineTo(triSX + px * shaftW, triSY + py * shaftW);
  // Flare out to triangle
  ctx.lineTo(tailX + px * triW, tailY + py * triW);
  // Tail tip
  ctx.lineTo(tailX, tailY);
  // Back up the other side
  ctx.lineTo(tailX - px * triW, tailY - py * triW);
  // Back to shaft
  ctx.lineTo(triSX - px * shaftW, triSY - py * shaftW);
  ctx.lineTo(HALF + vx * 6 - px * shaftW, HALF + vy * 6 - py * shaftW);
  // Other side of arrowhead
  ctx.lineTo(tipX - vx * headBack - px * shaftW, tipY - vy * headBack - py * shaftW);
  ctx.lineTo(tipX - vx * headBack - px * headW, tipY - vy * headBack - py * headW);
  ctx.closePath();
  ctx.fillStyle = col;
  ctx.fill();

  // Pivot hub
  ctx.beginPath();
  ctx.arc(HALF, HALF, 3, 0, Math.PI * 2);
  ctx.fillStyle = col;
  ctx.fill();
}
