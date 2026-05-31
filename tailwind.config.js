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
        primary: '#D4A017',
        'primary-hover': '#B8860B',
        secondary: '#DBDBDB',
      },
    },
  },
  plugins: [],
};
