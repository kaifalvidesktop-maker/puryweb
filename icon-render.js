// PuryWeb — background/icon-render.js
// Draws the gradient ♻️ mark with OffscreenCanvas and animates a 180° spin on the toolbar button.

import { recycleGeometry, BRAND } from '../shared/icons.js';

const RAD = Math.PI / 180;
const SIZES = [16, 32];
let currentRot = 0;
let spinning = false;

export function drawRecycle(ctx, size, rotDeg = 0) {
  const g = recycleGeometry(size);
  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.translate(size / 2, size / 2);
  ctx.rotate(rotDeg * RAD);
  ctx.translate(-size / 2, -size / 2);
  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, BRAND.orange);
  grad.addColorStop(1, BRAND.violet);
  ctx.strokeStyle = grad;
  ctx.fillStyle = grad;
  ctx.lineWidth = g.lw;
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'round';
  for (const a of g.arcs) {
    ctx.beginPath();
    ctx.arc(g.cx, g.cy, g.r, a.a0 * RAD, a.a1 * RAD);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(a.head[0][0], a.head[0][1]);
    ctx.lineTo(a.head[1][0], a.head[1][1]);
    ctx.lineTo(a.head[2][0], a.head[2][1]);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

export function renderIconSet(rotDeg = 0) {
  const out = {};
  for (const s of SIZES) {
    const canvas = new OffscreenCanvas(s, s);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    drawRecycle(ctx, s, rotDeg);
    out[s] = ctx.getImageData(0, 0, s, s);
  }
  return out;
}

export async function setActionIcon(rotDeg = currentRot) {
  await chrome.action.setIcon({ imageData: renderIconSet(rotDeg) });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

/** Rotate the toolbar icon by `deg` (default 180) with easing. Safe to call repeatedly. */
export async function spinIcon(deg = 180, ms = 420, steps = 10) {
  if (spinning) return;
  spinning = true;
  const from = currentRot;
  const to = from + deg;
  try {
    for (let i = 1; i <= steps; i++) {
      await setActionIcon(from + (to - from) * easeInOut(i / steps));
      await sleep(ms / steps);
    }
    currentRot = to % 360;
    await setActionIcon(currentRot);
  } finally {
    spinning = false;
  }
}
