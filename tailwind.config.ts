import type { Config } from 'tailwindcss';

// MeetingMind design tokens: a warm red gradient on white, with near-black ink.
const config: Config = {
  content: ['./components/**/*.{ts,tsx}', './app/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fff3f2', 100: '#ffe3e0', 200: '#ffc9c4', 300: '#ffa199', 400: '#ff6b5e',
          500: '#f43f32', 600: '#e0261a', 700: '#bb1a10', 800: '#991912', 900: '#7e1b15',
        },
        ink: {
          950: '#0a0a0a', 900: '#141414', 800: '#262626', 700: '#404040', 600: '#525252',
          500: '#737373', 400: '#a3a3a3', 300: '#d4d4d4', 200: '#e7e5e4', 100: '#f5f5f4', 50: '#fafaf9',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #ff6b4a 0%, #f43f32 45%, #c81e1e 100%)',
      },
      boxShadow: {
        card: '0 1px 2px rgba(10,10,10,.04), 0 2px 12px -4px rgba(10,10,10,.06)',
        lift: '0 12px 32px -12px rgba(10,10,10,.18)',
        glow: '0 10px 30px -10px rgba(244,63,50,.55)',
      },
      keyframes: {
        rise: { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'none' } },
        bar: { '0%,100%': { transform: 'scaleY(.35)' }, '50%': { transform: 'scaleY(1)' } },
      },
      animation: { rise: 'rise .3s cubic-bezier(.2,.7,.2,1) both', bar: 'bar 1s ease-in-out infinite' },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
export default config;
