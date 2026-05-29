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
          // Base
          navy:          '#1A2E4A',   // sidebar bg, elementos navales
          blue:          '#2570BA',   // botones primarios, acento, ítems activos
          'blue-light':  '#E8F0FB',   // hover suave activo

          // Fondos
          bg:            '#FFFFFF',   // fondo principal
          'bg-soft':     '#F7F8FA',   // fondo secundario / cards

          // Texto
          'text-1':      '#1C2533',   // texto principal
          'text-2':      '#4A5568',   // texto secundario

          // Bordes
          border:        '#E2E5EA',   // bordes generales

          // Legados (compatibilidad)
          'navy-light':  '#F0F3F7',
        }
      }
    },
  },
  plugins: [],
}
