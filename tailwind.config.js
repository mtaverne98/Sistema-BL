/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        bl: {
          navy: '#1a2e4a',
          blue: '#2570ba',
          'blue-light': '#e8f0fb',
          'navy-light': '#f0f3f7',
        }
      }
    },
  },
  plugins: [],
}
