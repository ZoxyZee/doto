import { createContext, createElement, useContext, useEffect, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import type { SQLiteDatabase } from 'expo-sqlite';

const light = {
  background: '#F7F1EC', surface: '#FFFCFA', surfaceMuted: '#F0E9FA',
  ink: '#241D29', muted: '#695E6C', purple: '#6538A1', purpleSoft: '#EEE3FC',
  line: '#E5DCE4', danger: '#AD3950', accent: '#FF956B',
  progressTrack: '#E8E0EA', tab: '#241D29', tabInactive: '#C6B9CC',
  inverse: '#241D29', onPrimary: '#FFFFFF',
};
const dark = {
  background: '#19151E', surface: '#29232F', surfaceMuted: '#342A41',
  ink: '#FAF5FB', muted: '#C7BBCB', purple: '#C9A8FA', purpleSoft: '#423354',
  line: '#4B3E51', danger: '#FFAAA8', accent: '#FFAA82',
  progressTrack: '#55435F', tab: '#100D14', tabInactive: '#AD9DB6',
  inverse: '#241D29', onPrimary: '#241D29',
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
