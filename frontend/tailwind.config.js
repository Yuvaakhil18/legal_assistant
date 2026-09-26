/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dante: {
          50: '#F0F7F7',
          100: '#E1EFEF',
          200: '#C6DEDF', // Dante Peak
          300: '#A3CBCC',
          500: '#4D9699',
          900: '#183B3D'
        }
      }
    },
  },
  plugins: [],
}
