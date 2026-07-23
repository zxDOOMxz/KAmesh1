import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors as defaultColors, type ThemeColors } from './colors';
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
  colors: defaultColors,
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>('cyber');
  const [colors, setColors] = useState<ThemeColors>(defaultColors);

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((v) => {
      if (v === 'minimal' || v === 'retro') {
        const target = themeColors[v];
        Object.assign(defaultColors, target);
        setThemeState(v);
        setColors({ ...target });
      }
    });
  }, []);

  const setTheme = (t: ThemeName) => {
    const target = themeColors[t];
    Object.assign(defaultColors, target);
    setThemeState(t);
    setColors({ ...target });
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
