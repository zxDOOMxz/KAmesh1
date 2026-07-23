export type ThemeColors = {
  bg: string;
  bgCard: string;
  bgCardHover: string;
  border: string;
  borderActive: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  neonCyan: string;
  neonCyanDim: string;
  neonPink: string;
  neonPinkDim: string;
  neonBlue: string;
  neonBlueDim: string;
  neonGreen: string;
  neonGreenDim: string;
  error: string;
  errorDim: string;
  success: string;
  warning: string;
  overlay: string;
};

export const colors: ThemeColors = {

  bg: '#0a0a0f',
  bgCard: 'rgba(255, 255, 255, 0.05)',
  bgCardHover: 'rgba(255, 255, 255, 0.08)',
  border: 'rgba(255, 255, 255, 0.1)',
  borderActive: 'rgba(0, 255, 255, 0.4)',
  text: '#f0f0f5',
  textSecondary: 'rgba(240, 240, 245, 0.6)',
  textMuted: 'rgba(240, 240, 245, 0.35)',

  neonCyan: '#00ffff',
  neonCyanDim: 'rgba(0, 255, 255, 0.15)',
  neonPink: '#ff00ff',
  neonPinkDim: 'rgba(255, 0, 255, 0.12)',
  neonBlue: '#4488ff',
  neonBlueDim: 'rgba(68, 136, 255, 0.12)',
  neonGreen: '#00ff88',
  neonGreenDim: 'rgba(0, 255, 136, 0.12)',

  error: '#ff3355',
  errorDim: 'rgba(255, 51, 85, 0.15)',
  success: '#00ff88',
  warning: '#ffaa00',

  overlay: 'rgba(0, 0, 0, 0.6)',
};
