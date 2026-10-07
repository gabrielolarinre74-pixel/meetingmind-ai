import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./components/**/*.{ts,tsx}', './app/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f5f1ff',
          100: '#ebe3ff',
          200: '#d6c8ff',
          400: '#9b7bff',
          500: '#7c4dff',
          600: '#6a35f0',
          700: '#5826d1',
          900: '#2a1366',
        },
        ink: { 900: '#0f0d1a', 800: '#1a1729', 700: '#2a2640', 500: '#6b6785', 300: '#b7b3cc' },
      },
      fontFamily: { sans: ['Lexend', 'system-ui', 'sans-serif'] },
      boxShadow: { soft: '0 10px 40px -12px rgba(76, 29, 149, 0.25)' },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
export default config;
