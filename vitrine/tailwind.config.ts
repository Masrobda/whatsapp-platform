import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],

  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#2d5016',
          light: '#3d6b1f',
          dark: '#1d3a0f',
        },
        secondary: {
          DEFAULT: '#8bc34a',
          light: '#a4d96c',
          dark: '#6da62a',
        },
        accent: {
          DEFAULT: '#2196f3',
          light: '#42a5f5',
          dark: '#1976d2',
        },
        dark: {
          DEFAULT: '#1a1a1a',
          light: '#2d2d2d',
          lighter: '#404040',
        },
        gray: {
          50: '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
          800: '#1f2937',
          900: '#111827',
        },
        white: '#ffffff',
        black: '#000000',
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, #2d5016 0%, #8bc34a 100%)',
        'gradient-accent': 'linear-gradient(135deg, #2196f3 0%, #1976d2 100%)',
        'gradient-dark': 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)',
      },
      animation: {
        'float': 'float 3s ease-in-out infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'marquee': 'marquee 30s linear infinite', // Ajout de l'animation marquee
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        marquee: { // Ajout des étapes de l'animation
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
