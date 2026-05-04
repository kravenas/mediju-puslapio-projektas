/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './*.html',
    './js/**/*.js',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#FFC50F',
        'primary-hover': '#E6B00F',
        secondary: '#DBDBDB',
      },
    },
  },
  plugins: [],
};
