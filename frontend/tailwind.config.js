export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#14532D', dark: '#0F3D22', soft: '#DCEFE2' },
        'brand-lime': '#E8F26B',
        accent: { DEFAULT: '#F59E0B', soft: '#FEF3C7' },
        info: '#0EA5E9',
        success: '#16A34A',
        warning: '#F59E0B',
        danger: '#DC2626',
        surface: '#F7F5EE',
        card: '#FFFFFF',
        border: '#E5E2D8',
        text: '#1C2A22',
        'text-muted': '#5B6B61'
      }
    }
  },
  plugins: []
};
