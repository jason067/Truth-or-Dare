/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        outfit: ['Outfit', 'sans-serif'],
      },
      colors: {
        'party-bg': '#070412',
        'party-dark': '#110b29',
        'truth-cyan': '#00f0ff',
        'dare-pink': '#ff007f',
      },
    },
  },
  plugins: [],
}
