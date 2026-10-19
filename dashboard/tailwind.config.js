import type { Config } from "tailwindcss";

const config: Config = {
    darkMode: ["class"],
    content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",           // App Router (pages, layouts, etc.)
    "./components/**/*.{js,ts,jsx,tsx,mdx}",    // Tous tes composants UI
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",           // Utilitaires, API helpers
  ],
  theme: {
  	extend: {
  		colors: {
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				light: '#3d6b1f',
  				dark: '#1d3a0f',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				light: '#a4d96c',
  				dark: '#6da62a',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				light: '#42a5f5',
  				dark: '#1976d2',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			dark: {
  				DEFAULT: '#1a1a1a',
  				light: '#2d2d2d',
  				lighter: '#404040'
  			},
  			success: '#4caf50',
  			warning: '#ff9800',
  			error: '#f44336',
  			info: '#2196f3',
  			gray: {
  				'50': '#f9fafb',
  				'100': '#f3f4f6',
  				'200': '#e5e7eb',
  				'300': '#d1d5db',
  				'400': '#9ca3af',
  				'500': '#6b7280',
  				'600': '#4b5563',
  				'700': '#374151',
  				'800': '#1f2937',
  				'900': '#111827'
  			},
  			red: {
  				'50': '#fef2f2',
  				'100': '#fee2e2',
  				'200': '#fecaca',
  				'500': '#ef4444',
  				'600': '#dc2626',
  				'700': '#b91c1c'
  			},
  			yellow: {
  				'100': '#fef3c7',
  				'500': '#eab308',
  				'700': '#a16207'
  			},
  			blue: {
  				'100': '#dbeafe',
  				'500': '#3b82f6',
  				'700': '#1d4ed8'
  			},
  			green: {
  				'100': '#dcfce7',
  				'500': '#22c55e',
  				'700': '#15803d'
  			},
  			purple: {
  				'100': '#f3e8ff',
  				'500': '#a855f7',
  				'700': '#7e22ce'
  			},
  			indigo: {
  				'100': '#e0e7ff',
  				'500': '#6366f1',
  				'700': '#4338ca'
  			},
  			cyan: {
  				'100': '#cffafe',
  				'700': '#0e7490'
  			},
  			pink: {
  				'500': '#ec4899'
  			},
  			teal: {
  				'500': '#14b8a6'
  			},
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			}
  		},
  		backgroundImage: {
  			'gradient-primary': 'linear-gradient(135deg, #2d5016 0%, #8bc34a 100%)',
  			'gradient-accent': 'linear-gradient(135deg, #2196f3 0%, #1976d2 100%)'
  		},
  		boxShadow: {
  			custom: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  			'custom-lg': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
