/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#181b21',
          elevated: '#1e2128',
        },
        card: {
          DEFAULT: '#232730',
          hover: '#2a2f38',
        },
        input: {
          DEFAULT: '#2a2f36',
        },
        border: {
          DEFAULT: '#3a3f48',
          light: '#4a4f58',
        },
        content: {
          DEFAULT: '#f3f4f6',
          secondary: '#c8c8dc',
          muted: '#8b8ba3',
          placeholder: '#6b7280',
        },
        accent: {
          DEFAULT: '#9333ea',
          hover: '#7e22ce',
          light: '#a855f7',
          subtle: '#581c87',
        },
        success: {
          DEFAULT: '#16a34a',
          hover: '#15803d',
          light: '#22c55e',
          subtle: '#14532d',
        },
        danger: {
          DEFAULT: '#dc2626',
          hover: '#b91c1c',
          light: '#ef4444',
          subtle: '#7f1d1d',
        },
        warning: {
          DEFAULT: '#d97706',
          hover: '#b45309',
          light: '#f59e0b',
          subtle: '#78350f',
        },
        info: {
          DEFAULT: '#2563eb',
          hover: '#1d4ed8',
          light: '#3b82f6',
          subtle: '#1e3a5f',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      borderRadius: {
        'xl': '0.75rem',
        '2xl': '1rem',
      },
      animation: {
        'spin-slow': 'spin 2s linear infinite',
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
}
