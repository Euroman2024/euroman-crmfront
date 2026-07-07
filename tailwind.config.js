/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#111b21', // Fondo de la bandeja y general
        surface: '#202c33', // Cabeceras y barra inferior
        primary: '#00a884', // Verde WhatsApp
        'bubble-out': '#005c4b', // Burbuja enviada
        'bubble-in': '#202c33', // Burbuja recibida
        hover: '#2a3942', // Hover en chats
        accent: '#00a884',
        border: '#222d34', // Separador fino
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.6s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        }
      }
    },
  },
  plugins: [],
}
