/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0b1020',
        panel: '#11182b',
        line: '#24304a',
        muted: '#8390aa',
        cyan: '#55d5e6',
        violet: '#a68bfa',
        amber: '#f7c873',
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(85,213,230,.08), 0 18px 48px rgba(3,8,24,.28)',
      },
    },
  },
  daisyui: {
    themes: [
      {
        archidiag: {
          primary: '#55d5e6',
          secondary: '#a68bfa',
          accent: '#f7c873',
          neutral: '#1b2540',
          'base-100': '#0b1020',
          'base-200': '#11182b',
          'base-300': '#1a2540',
          'base-content': '#e8eefc',
          info: '#63b3ed',
          success: '#55d6a1',
          warning: '#f7c873',
          error: '#f47c8b',
        },
      },
    ],
  },
  plugins: [require('daisyui')],
}
