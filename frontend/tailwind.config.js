/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f7ff',
          100: '#e0effe',
          200: '#bae0fd',
          300: '#7cc8fc',
          400: '#36abfa',
          500: '#0c8ee9',
          600: '#0070c7',
          700: '#0159a2',
          800: '#064b85',
          900: '#0b3f6f',
          950: '#07284a',
        },
        slate: {
          850: '#151e2e',
          950: '#0b0f19',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      keyframes: {
        'lb-rise': {
          '0%': { transform: 'scaleY(0)', opacity: '0' },
          '100%': { transform: 'scaleY(1)', opacity: '1' },
        },
        'lb-pop': {
          '0%': { transform: 'scale(0.3)', opacity: '0' },
          '70%': { transform: 'scale(1.12)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'lb-bob': {
          '0%, 100%': { transform: 'translateY(0) rotate(-6deg)' },
          '50%': { transform: 'translateY(-5px) rotate(6deg)' },
        },
        'lb-slide': {
          '0%': { transform: 'translateX(-16px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        'lb-glow': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(245, 158, 11, 0.55)' },
          '50%': { boxShadow: '0 0 0 12px rgba(245, 158, 11, 0)' },
        },
      },
      animation: {
        'lb-rise': 'lb-rise 0.7s cubic-bezier(0.22, 1, 0.36, 1) both',
        'lb-pop': 'lb-pop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both',
        'lb-bob': 'lb-bob 2.4s ease-in-out infinite',
        'lb-slide': 'lb-slide 0.45s ease-out both',
        'lb-glow': 'lb-glow 2.2s ease-out infinite',
      },
    },
  },
  plugins: [],
}
