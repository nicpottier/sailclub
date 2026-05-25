/**
 * Wind indicator HUD — a masthead Windex-style gauge in the upper-left.
 * Shows apparent wind direction relative to the boat's bow.
 */

const SIZE = 120;
const HALF = SIZE / 2;
const ARROW_LEN = 38;

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

/**
 * windAngle: where the wind blows FROM relative to the bow (radians).
 *   negative = port, positive = starboard.
 */
export function updateWindHUD(windAngle: number): void {
  ctx.clearRect(0, 0, SIZE, SIZE);

  // Outer ring
  ctx.beginPath();
  ctx.arc(HALF, HALF, HALF - 4, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Tick marks every 30 degrees
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6 - Math.PI / 2; // 0 = top
    const inner = i % 3 === 0 ? HALF - 16 : HALF - 10;
    ctx.beginPath();
    ctx.moveTo(HALF + Math.cos(a) * inner, HALF + Math.sin(a) * inner);
    ctx.lineTo(HALF + Math.cos(a) * (HALF - 6), HALF + Math.sin(a) * (HALF - 6));
    ctx.stroke();
  }

  // Bow marker (top center)
  ctx.beginPath();
  ctx.moveTo(HALF, 8);
  ctx.lineTo(HALF - 5, 16);
  ctx.lineTo(HALF + 5, 16);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.fill();

  // No-go zone shading (~30 degrees each side of bow)
  const noGo = Math.PI / 6;
  ctx.beginPath();
  ctx.moveTo(HALF, HALF);
  ctx.arc(HALF, HALF, HALF - 6, -Math.PI / 2 - noGo, -Math.PI / 2 + noGo);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255, 80, 80, 0.15)';
  ctx.fill();

  // Windex-style vane — thin pointer into the wind, forked tail fins
  const arrowAngle = -Math.PI / 2 + windAngle;
  const ax = Math.cos(arrowAngle);
  const ay = Math.sin(arrowAngle);
  // Perpendicular
  const px = -ay;
  const py = ax;

  const tipLen = 40;   // pointer length (toward wind)
  const tailLen = 22;  // shaft behind pivot
  const finLen = 14;   // tail fin length
  const finSpread = 0.4; // fin splay angle (radians)

  const tipX = HALF + ax * tipLen;
  const tipY = HALF + ay * tipLen;
  const tailX = HALF - ax * tailLen;
  const tailY = HALF - ay * tailLen;

  // Filled pointer: narrow triangle from tip to just past center
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(HALF + px * 2.5, HALF + py * 2.5);
  ctx.lineTo(HALF - px * 2.5, HALF - py * 2.5);
  ctx.closePath();
  ctx.fillStyle = '#ff4444';
  ctx.fill();

  // Shaft from center to tail
  ctx.beginPath();
  ctx.moveTo(HALF, HALF);
  ctx.lineTo(tailX, tailY);
  ctx.strokeStyle = '#ff4444';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Tail fins — two angled vanes spreading from the tail end
  const finAngleL = arrowAngle + Math.PI - finSpread;
  const finAngleR = arrowAngle + Math.PI + finSpread;
  ctx.beginPath();
  ctx.moveTo(tailX, tailY);
  ctx.lineTo(tailX + Math.cos(finAngleL) * finLen, tailY + Math.sin(finAngleL) * finLen);
  ctx.moveTo(tailX, tailY);
  ctx.lineTo(tailX + Math.cos(finAngleR) * finLen, tailY + Math.sin(finAngleR) * finLen);
  ctx.strokeStyle = '#ff4444';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Pivot dot
  ctx.beginPath();
  ctx.arc(HALF, HALF, 3, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.fill();

}
