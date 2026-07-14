import { Platform } from 'react-native';

const mono = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'monospace',
});

export const typography = {
  display: {
    fontSize: 48,
    fontWeight: '300' as const,
    letterSpacing: -2,
    fontFamily: mono,
  },
  h1: {
    fontSize: 32,
    fontWeight: '700' as const,
    letterSpacing: -0.5,
    fontFamily: mono,
  },
  h2: {
    fontSize: 24,
    fontWeight: '600' as const,
    letterSpacing: -0.3,
    fontFamily: mono,
  },
  body: {
    fontSize: 16,
    fontWeight: '400' as const,
    letterSpacing: 0.2,
    fontFamily: mono,
  },
  caption: {
    fontSize: 13,
    fontWeight: '400' as const,
    letterSpacing: 0.3,
    fontFamily: mono,
  },
  button: {
    fontSize: 15,
    fontWeight: '600' as const,
    letterSpacing: 0.5,
    fontFamily: mono,
    textTransform: 'uppercase' as const,
  },
};
