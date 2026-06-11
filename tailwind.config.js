/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        cantarell: ['Cantarell', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        adw: {
          window: '#242424',
          view: '#2d2d2d',
          card: '#383838',
          popover: '#383838',
          dialog: '#3d3d3d',
          border: '#1e1e1e',
          blue: '#3584e4',
          green: '#2ec27e',
          yellow: '#f5c211',
          orange: '#f99b1d',
          red: '#e01b24',
          purple: '#9141ac',
          brown: '#cdab8f',
          pink: '#ff669b',
          gray: '#8b8e8f',
          fg: '#ffffff',
          'fg-dim': '#a8a8a8',
          'fg-secondary': '#a8a8a8',
          accent: '#3584e4',
          'accent-dim': '#2a68b2',
          destructive: '#e01b24',
          header: '#2d2d2d',
          sidebar: '#1e1e1e',
          selected: '#ffffff1a',
          hover: '#ffffff12',
          active: '#ffffff26',
          'drop-target': '#3584e466',
        }
      },
      borderRadius: {
        'adw-sm': '12px',
        'adw': '16px',
        'adw-lg': '20px',
      }
    },
  },
  plugins: [],
}