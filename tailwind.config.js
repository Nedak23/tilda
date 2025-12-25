/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Things dark mode color palette
        accent: {
          DEFAULT: '#FFD60A', // Yellow star color
          blue: '#5BA4F5',
          hover: '#E6C009',
        },
        surface: {
          DEFAULT: '#1C1C1E', // Sidebars (dark)
          secondary: '#2C2C2E', // Cards
          tertiary: '#3A3A3C', // Hover states
          elevated: '#3A3A3C', // Elevated cards
          selected: '#5A5A5C', // Selected item background
          button: '#6B6B6E', // Secondary button background
          buttonHover: '#7B7B7E', // Secondary button hover
        },
        text: {
          DEFAULT: '#FFFFFF',
          secondary: '#98989D',
          tertiary: '#636366',
          placeholder: '#636366',
        },
        border: {
          DEFAULT: '#3A3A3C',
          light: '#2C2C2E',
          selected: '#6A6A6C', // Selected item border
        },
        success: '#32D74B',
        warning: '#FF9F0A',
        error: '#FF453A',
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'SF Pro Text',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      fontSize: {
        '2xs': '0.625rem',
      },
      boxShadow: {
        'subtle': '0 1px 3px rgba(0, 0, 0, 0.3)',
        'elevated': '0 4px 12px rgba(0, 0, 0, 0.4)',
        'modal': '0 8px 32px rgba(0, 0, 0, 0.5)',
        'card': '0 2px 8px rgba(0, 0, 0, 0.3)',
      },
      animation: {
        'fade-in': 'fadeIn 150ms ease-out',
        'slide-up': 'slideUp 200ms ease-out',
        'pulse-dot': 'pulseDot 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseDot: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
      },
    },
  },
  plugins: [],
}
