/** Tailwind config for the injected (light) purified UI. Scans our own templates only. */
export default {
  content: ['../templates/*.js', '../content/renderer.js'],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'Noto Sans Bengali', 'Segoe UI', 'system-ui', '-apple-system', 'sans-serif'] },
      colors: { pw: { orange: '#FF6B35', violet: '#7C3AED', ink: '#0A0A0B' } },
    },
  },
  plugins: [],
};
