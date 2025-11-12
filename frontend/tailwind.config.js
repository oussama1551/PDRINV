/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#FEF6E7',
          100: '#FDEDCF',
          200: '#FBDBA0',
          300: '#F9C970',
          400: '#F7B741',
          500: '#F8AD41',
          600: '#E69B2A',
          700: '#B87A21',
          800: '#8A5A18',
          900: '#5C3A10',
        },
      },
      fontFamily: {
        //sans: ['Poppins', 'system-ui', 'sans-serif'], // default font
        // or for Montserrat:
        sans: ['Montserrat', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
