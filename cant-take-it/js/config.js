/** Game-wide constants and LTTP-inspired palette. */

export const TILE = 16;
export const SCALE = 3;
export const VIEW_W = 320; // logical pixels
export const VIEW_H = 240;

export const PALETTE = {
  bg: '#1a1420',
  floor: '#5a4a3a',
  floorLight: '#6b5a48',
  floorDark: '#3d3228',
  wall: '#4a3c2e',
  wallEdge: '#2a2218',
  wood: '#8b6914',
  woodDark: '#5c4510',
  grass: '#4a6b3a',
  grassDark: '#2f4a28',
  stone: '#6a6a72',
  stoneDark: '#3a3a42',
  gold: '#d4a84b',
  goldDark: '#8a6830',
  uiBg: '#181818',
  uiBorder: '#e8d8a0',
  uiBorderDark: '#887848',
  uiText: '#f0e8c8',
  uiShadow: '#000000',
  accent: '#c8a050',
  danger: '#c04040',
  lamp: '#ffcc66',
  lampGlow: '#ffaa22',
  skin: '#e8b878',
  skinDark: '#c09058',
  shirt: '#3868a0',
  pants: '#2a3a58',
  hairDark: '#2a1a10',
  hairBlonde: '#d4b060',
  hairRed: '#a03828',
  hairGray: '#a0a0a8',
};

export const HAIR_COLORS = {
  dark: PALETTE.hairDark,
  blonde: PALETTE.hairBlonde,
  red: PALETTE.hairRed,
};

export const DIFFICULTIES = {
  easy: {
    id: 'easy',
    label: 'Easy',
    inflation: 0.02,
    equityReturn: 0.09,
    salaryGrowth: 0.04,
    expensePressure: 0.9,
    taxMult: 0.9,
    collegeCost: 18000,
  },
  standard: {
    id: 'standard',
    label: 'Standard',
    inflation: 0.025,
    equityReturn: 0.07,
    salaryGrowth: 0.03,
    expensePressure: 1.0,
    taxMult: 1.0,
    collegeCost: 25000,
  },
  difficult: {
    id: 'difficult',
    label: 'Difficult',
    inflation: 0.035,
    equityReturn: 0.045,
    salaryGrowth: 0.02,
    expensePressure: 1.2,
    taxMult: 1.1,
    collegeCost: 35000,
  },
};

export const HOME_TYPES = {
  primary: { label: 'Primary Residence', taxRate: 0.012 },
  secondary: { label: 'Secondary / Vacation', taxRate: 0.014 },
  investment: { label: 'Investment Property', taxRate: 0.015 },
};

export const SAVE_KEY = 'ycitwy_saves_v1';
export const MAX_AGE = 100;
export const RETIREMENT_AGE = 65;

export const CURRENT_YEAR = new Date().getFullYear();

export const KEYS = {
  up: ['ArrowUp', 'w', 'W'],
  down: ['ArrowDown', 's', 'S'],
  left: ['ArrowLeft', 'a', 'A'],
  right: ['ArrowRight', 'd', 'D'],
  confirm: ['Enter', ' ', 'z', 'Z', 'e', 'E'],
  cancel: ['Escape', 'x', 'X'],
};
