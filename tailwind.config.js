/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ee: '#22c55e',
        me: '#3b82f6',
        ae: '#f59e0b',
        be: '#ef4444',
      },
    },
  },
  plugins: [],
}
