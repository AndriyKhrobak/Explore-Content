import type { Config } from 'tailwindcss';

export default {
  content: [
    './components/**/*.{vue,ts}',
    './pages/**/*.{vue,ts}',
    './app.vue',
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          base: '#0a0a0f',
          panel: '#12121a',
          elevated: '#1a1a24',
        },
        accent: {
          DEFAULT: '#7c3aed',
          glow: '#a855f7',
        },
        line: '#26262e',
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      backgroundImage: {
        'hero-glow':
          'radial-gradient(ellipse 80% 60% at 50% -20%, rgba(124,58,237,0.35), transparent 70%)',
      },
    },
  },
  plugins: [],
} satisfies Config;
