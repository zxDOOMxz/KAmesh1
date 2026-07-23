import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, type ThemeColors } from './colors';
import { themeColors, type ThemeName } from './themes';

export type { ThemeName };

const THEME_KEY = 'app_theme';

interface ThemeContextType {
  theme: ThemeName;
  setTheme: (t: ThemeName) => void;
  colors: ThemeColors;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'cyber',
  setTheme: () => {},
  colors,
});

function applyTheme(name: ThemeName) {
  const target = themeColors[name];
  Object.assign(colors, target);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>('cyber');

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((v) => {
      if (v === 'minimal' || v === 'retro') {
        applyTheme(v);
        setThemeState(v);
      }
    });
  }, []);

  const setTheme = (t: ThemeName) => {
    applyTheme(t);
    setThemeState(t);
    AsyncStorage.setItem(THEME_KEY, t);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, colors }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
