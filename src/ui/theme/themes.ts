import { colors as cyber } from './colors';

export type ThemeName = 'cyber' | 'minimal' | 'retro';

const minimal = {
  bg: '#0d0d0d',
  bgCard: 'rgba(255, 255, 255, 0.04)',
  bgCardHover: 'rgba(255, 255, 255, 0.06)',
  border: 'rgba(255, 255, 255, 0.08)',
  borderActive: 'rgba(180, 180, 180, 0.4)',
  text: '#e0e0e0',
  textSecondary: 'rgba(224, 224, 224, 0.6)',
  textMuted: 'rgba(224, 224, 224, 0.35)',
  neonCyan: '#999999',
  neonCyanDim: 'rgba(153, 153, 153, 0.15)',
  neonPink: '#888888',
  neonPinkDim: 'rgba(136, 136, 136, 0.12)',
  neonBlue: '#777777',
  neonBlueDim: 'rgba(119, 119, 119, 0.12)',
  neonGreen: '#aaaaaa',
  neonGreenDim: 'rgba(170, 170, 170, 0.12)',
  error: '#cc4444',
  errorDim: 'rgba(204, 68, 68, 0.15)',
  success: '#66aa66',
  warning: '#ccaa44',
  overlay: 'rgba(0, 0, 0, 0.6)',
};

const retro = {
  bg: '#0c0c08',
  bgCard: 'rgba(0, 180, 50, 0.05)',
  bgCardHover: 'rgba(0, 180, 50, 0.08)',
  border: 'rgba(0, 200, 60, 0.15)',
  borderActive: 'rgba(0, 255, 60, 0.5)',
  text: '#33ff66',
  textSecondary: 'rgba(51, 255, 102, 0.6)',
  textMuted: 'rgba(51, 255, 102, 0.35)',
  neonCyan: '#00ff44',
  neonCyanDim: 'rgba(0, 255, 68, 0.15)',
  neonPink: '#ff8800',
  neonPinkDim: 'rgba(255, 136, 0, 0.12)',
  neonBlue: '#ffcc00',
  neonBlueDim: 'rgba(255, 204, 0, 0.12)',
  neonGreen: '#00ff44',
  neonGreenDim: 'rgba(0, 255, 68, 0.12)',
  error: '#ff4444',
  errorDim: 'rgba(255, 68, 68, 0.15)',
  success: '#00ff44',
  warning: '#ff8800',
  overlay: 'rgba(0, 0, 0, 0.7)',
};

export const themeColors: Record<ThemeName, typeof cyber> = {
  cyber,
  minimal,
  retro,
};
