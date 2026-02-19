/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        'game': ['Arial', 'sans-serif'],
      },
      colors: {
        'game-gold': '#FFD700',
        'game-gold-dark': '#B8860B',
        'game-red': '#DC143C',
        'game-bg': 'rgba(0, 0, 0, 0.8)',
      },
      boxShadow: {
        'game': '0 4px 12px rgba(255, 215, 0, 0.4)',
        'game-hover': '0 4px 15px rgba(255, 215, 0, 0.5)',
        'game-glow': '0 0 10px rgba(255, 215, 0, 0.5)',
        'game-text': '0 0 8px rgba(255, 215, 0, 0.3)',
      },
      animation: {
        'bounce-soft': 'bounce 1s ease-in-out',
        'glow-pulse': 'pulse 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}