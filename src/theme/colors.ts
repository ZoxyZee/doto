import { createContext, createElement, useContext, useEffect, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import type { SQLiteDatabase } from 'expo-sqlite';

const light = {
  background: '#F1ECE5', surface: '#FFFCF8', surfaceMuted: '#F8F2EB',
  ink: '#292622', muted: '#716B64', purple: '#A34F2E', purpleSoft: '#F8E8DC',
  line: '#E3DBD2', danger: '#A63E3C', accent: '#F59A6A',
  progressTrack: '#E7DED4', tab: '#252522', tabInactive: '#BBB3AA',
  inverse: '#252522', onPrimary: '#FFFFFF',
};
const dark = {
  background: '#1D1C1A', surface: '#2B2926', surfaceMuted: '#34302B',
  ink: '#F7F2EB', muted: '#BDB3A8', purple: '#F2B38D', purpleSoft: '#48352B',
  line: '#48413D', danger: '#FFAAA4', accent: '#FFAE7D',
  progressTrack: '#51473F', tab: '#141413', tabInactive: '#A9A39B',
  inverse: '#292622', onPrimary: '#292622',
};

export type Palette = typeof light;
export const colors = light;
export type ThemeMode = 'system' | 'light' | 'dark';
type ThemeContextValue = { mode: ThemeMode; setMode: (mode: ThemeMode) => Promise<void> };
const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ db, children }: { db: SQLiteDatabase; children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('system');
  useEffect(() => {
    let active = true;
    void db.getFirstAsync<{ value: string }>("SELECT value FROM sync_metadata WHERE key = 'theme_mode'")
      .then((row) => {
        if (active && (row?.value === 'light' || row?.value === 'dark')) setModeState(row.value);
      });
    return () => { active = false; };
  }, [db]);
  async function setMode(next: ThemeMode) {
    await db.runAsync("INSERT INTO sync_metadata (key, value) VALUES ('theme_mode', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", next);
    setModeState(next);
  }
  return createElement(ThemeContext.Provider, { value: { mode, setMode } }, children);
}

export function useTheme() { return useContext(ThemeContext); }
export function useResolvedTheme(): 'light' | 'dark' {
  const system = useColorScheme();
  const preference = useTheme()?.mode ?? 'system';
  return (preference === 'system' ? system : preference) === 'dark' ? 'dark' : 'light';
}
export function usePalette(): Palette { return useResolvedTheme() === 'dark' ? dark : light; }

export const type = {
  display: 'Fraunces_600SemiBold',
  body: 'DMSans_400Regular',
  medium: 'DMSans_500Medium',
  bold: 'DMSans_700Bold',
};
