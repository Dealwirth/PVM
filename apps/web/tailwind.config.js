/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Palette inspired by Home Assistant defaults.
        ha: {
          primary: '#03a9f4',
          accent: '#ff9800',
          success: '#4caf50',
          warning: '#ff9800',
          error: '#f44336',
          bg: '#111827',
          surface: '#1f2937',
          surfaceAlt: '#273449',
          border: '#374151',
        },
      },
      fontFamily: {
        sans: ['Roboto', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
