
// theme.js
export const C = {
  bg0: '#060B18',
  bg1: '#0A1020',
  bg2: '#0F1830',
  bg3: '#162040',
  border: '#1E2D50',
  borderLight: '#243560',
  teal: '#00E5C4',
  tealMid: '#00C4A8',
  tealDim: '#008F7A',
  tealBg: 'rgba(0,229,196,0.10)',
  tealBg2: 'rgba(0,229,196,0.06)',
  tealGlow: 'rgba(0,229,196,0.22)',
  gold: '#FFB830',
  goldDim: '#E5A020',
  goldBg: 'rgba(255,184,48,0.12)',
  goldGlow: 'rgba(255,184,48,0.25)',
  green: '#22D67A',
  greenBg: 'rgba(34,214,122,0.12)',
  red: '#FF4D6A',
  redBg: 'rgba(255,77,106,0.12)',
  blue: '#4D9EFF',
  blueBg: 'rgba(77,158,255,0.12)',
  orange: '#FF8C42',
  orangeBg: 'rgba(255,140,66,0.12)',
  t1: '#F0F6FF',
  t2: '#8BA0C4',
  t3: '#4A5F85',
  inv: '#060B18',
  white: '#FFFFFF',
};

export const G = {
  tealBtn: [C.teal, C.tealMid],
  goldBtn: [C.gold, C.goldDim],
  redBtn: ['#FF4D6A', '#D93558'],
  heroCard: ['#0C1E3A', '#081428'],
  activeCard: ['#062820', '#031A10'],
  card: ['#0F1830', '#0C1526'],
};

export const R = { xs: 6, sm: 10, md: 14, lg: 20, xl: 26, full: 999 };

export const Sh = {
  teal: { shadowColor: '#00E5C4', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.30, shadowRadius: 16, elevation: 10 },
  gold: { shadowColor: '#FFB830', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 8 },
  card: { shadowColor: '#000000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.50, shadowRadius: 20, elevation: 12 },
  soft: { shadowColor: '#000000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.30, shadowRadius: 8, elevation: 4 },
};