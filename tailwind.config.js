/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#09090b', // Deepest Zinc/Black
        surface: '#18181b', // Zinc 900
        'surface-variant': '#27272a', // Zinc 800
        primary: 'rgb(var(--color-primary) / <alpha-value>)', // Dynamic Primary
        'primary-container': 'rgb(var(--color-primary) / 0.2)',
        secondary: '#E6C08D',
        'secondary-container': '#3E3528',
        on: {
          background: '#FFFFFF',
          surface: '#F4F4F5', // Zinc 100
          primary: '#FFFFFF',
        },
        outline: '#52525b', // Zinc 600
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      borderRadius: {
        'lg': '16px',
        'xl': '24px',
        '2xl': '32px',
        '3xl': '40px',
        '4xl': '56px',
        'full': '9999px',
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
        'ios-small': '0 2px 8px rgba(0, 0, 0, 0.12)',
        'ios-medium': '0 8px 24px rgba(0, 0, 0, 0.15)',
        'ios-large': '0 16px 48px rgba(0, 0, 0, 0.25)',
      },
      backdropBlur: {
        'xs': '2px',
        '3xl': '64px',
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}
