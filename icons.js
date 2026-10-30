// PuryWeb — shared/icons.js
// Single source of truth for brand colors and the ♻️ mark (SVG + canvas share one geometry).

export const BRAND = Object.freeze({
  orange: '#FF6B35',
  violet: '#7C3AED',
  base: '#0A0A0B',
  card: '#141416',
  border: '#27272A',
  text: '#FFFFFF',
  muted: '#A1A1AA',
});

export const BRAND_GRADIENT = `linear-gradient(135deg, ${BRAND.orange} 0%, ${BRAND.violet} 100%)`;

const RAD = Math.PI / 180;
const r2 = (n) => Math.round(n * 100) / 100;

function polar(cx, cy, r, deg) {
  return [cx + r * Math.cos(deg * RAD), cy + r * Math.sin(deg * RAD)];
}

/**
 * Geometry of three clockwise arrows forming a minimal recycle loop.
 * Angles are in degrees (canvas convention: 0 = east, clockwise positive).
 */
export function recycleGeometry(size = 100) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.33;
  const lw = size <= 32 ? size * 0.15 : size * 0.115;
  const arcs = [];
  for (let k = 0; k < 3; k++) {
    const a0 = -90 + k * 120 + 20;
    const a1 = a0 + 70;
    const [px, py] = polar(cx, cy, r, a1);
    const nx = Math.cos(a1 * RAD);
    const ny = Math.sin(a1 * RAD);
    const tx = -Math.sin(a1 * RAD);
    const ty = Math.cos(a1 * RAD);
    const half = lw * 1.1;
    const reach = lw * 1.7;
    arcs.push({
      a0,
      a1,
      start: polar(cx, cy, r, a0),
      end: [px, py],
      head: [
        [px + nx * half, py + ny * half],
        [px + tx * reach, py + ty * reach],
        [px - nx * half, py - ny * half],
      ],
    });
  }
  return { size, cx, cy, r, lw, arcs };
}

let uid = 0;

/** Inline SVG string of the PuryWeb mark. */
export function recycleSvg({ size = 24, title = 'PuryWeb', className = '' } = {}) {
  const g = recycleGeometry(100);
  const id = `pwg${++uid}`;
  const paths = g.arcs
    .map((a) => {
      const d = `M${r2(a.start[0])} ${r2(a.start[1])} A${r2(g.r)} ${r2(g.r)} 0 0 1 ${r2(a.end[0])} ${r2(a.end[1])}`;
      const head = a.head.map((p) => `${r2(p[0])},${r2(p[1])}`).join(' ');
      return `<path d="${d}" fill="none" stroke="url(#${id})" stroke-width="${r2(g.lw)}"/><polygon points="${head}" fill="url(#${id})" stroke="url(#${id})" stroke-width="1" stroke-linejoin="round"/>`;
    })
    .join('');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100" role="img" aria-label="${title}" class="${className}">` +
    `<defs><linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="100" y2="100">` +
    `<stop offset="0" stop-color="${BRAND.orange}"/><stop offset="1" stop-color="${BRAND.violet}"/></linearGradient></defs>` +
    `${paths}</svg>`
  );
}

/** Data URL for favicons of extension pages. */
export function faviconDataUrl() {
  return 'data:image/svg+xml,' + encodeURIComponent(recycleSvg({ size: 64 }));
}
