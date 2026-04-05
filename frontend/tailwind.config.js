export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    fontFamily: { sans: ['Inter', 'sans-serif'] },
    extend: {
      colors: {
        neoBg: '#fefefe', neoPrimary: '#ff4d4d', neoSecondary: '#3366ff', neoAccent: '#ffe600', neoText: '#111', neoGreen: '#00cc44'
      },
      boxShadow: { neo: '4px 4px 0px 0px rgba(0,0,0,1)', neoHover: '2px 2px 0px 0px rgba(0,0,0,1)' },
      borderWidth: { '3': '3px' }
    }
  },
  plugins: [],
}
