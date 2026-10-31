// PuryWeb — content/shuffle.js
// "Tiny Shuffle": every open gets a ±5% random radius/shadow/spacing so the UI never looks identical twice.

const jitter = (spread) => 1 + (Math.random() * 2 - 1) * spread;

export function shuffleTokens({ enabled = true, radius = 20, spread = 0.05 } = {}) {
  const j = () => (enabled ? jitter(spread) : 1);
  return {
    radius: Math.round(radius * j() * 10) / 10,
    shadowY: Math.round(24 * j()),
    shadowBlur: Math.round(64 * j()),
    shadowAlpha: Math.round(0.5 * j() * 100) / 100,
    gap: Math.round(16 * j()),
    pad: Math.round(28 * j()),
  };
}

export function applyTokens(el, tk) {
  el.style.setProperty('--radius', tk.radius + 'px');
  el.style.setProperty('--sy', tk.shadowY + 'px');
  el.style.setProperty('--sb', tk.shadowBlur + 'px');
  el.style.setProperty('--sa', String(tk.shadowAlpha));
  el.style.setProperty('--gap', tk.gap + 'px');
  el.style.setProperty('--pad', tk.pad + 'px');
}
