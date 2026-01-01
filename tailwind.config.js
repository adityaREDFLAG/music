/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#050505', // AMOLED Black-ish
        surface: '#121212', // Deep Charcoal
        'surface-variant': '#1E1E1E', // Lighter Charcoal
        primary: 'rgb(var(--color-primary) / <alpha-value>)', // Dynamic Primary
        'primary-container': '#3E2723', // Dark Brown/Orange container
        secondary: '#E6C08D', // Cream
        'secondary-container': '#3E3528',
        on: {
          background: '#E2E2E6',
          surface: '#E2E2E6',
          primary: '#4E2600',
        },
        outline: '#938F99',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'sans-serif'], // Keep existing font
      },
      borderRadius: {
        'lg': '16px',
        'xl': '24px',
        '2xl': '32px',
        '3xl': '48px', // Large radii for M3 Expressive
        'full': '9999px',
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
      },
      backdropBlur: {
        'xs': '2px',
      }
    },
  },
  plugins: [],
}
