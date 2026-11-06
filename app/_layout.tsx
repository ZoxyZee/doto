import { Stack } from 'expo-router';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { Suspense, useEffect } from 'react';
import { ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { CloudProvider } from '@/cloud/CloudProvider';
import { migrateDatabase } from '@/database/migrations';
import { useHabitStore } from '@/store/useHabitStore';
import { ThemeProvider, usePalette, useResolvedTheme } from '@/theme/colors';
import { ProfileProvider } from '@/profile/ProfileProvider';

function AppStack() {
  const db = useSQLiteContext();
  const palette = usePalette();
  const resolvedTheme = useResolvedTheme();
  const refresh = useHabitStore((state) => state.refresh);
  useEffect(() => { void refresh(db); }, [db, refresh]);
  return <><StatusBar style={resolvedTheme === 'dark' ? 'light' : 'dark'} /><Stack screenOptions={{ headerStyle: { backgroundColor: palette.background }, headerTintColor: palette.ink, headerShadowVisible: false, contentStyle: { backgroundColor: palette.background } }}>
    <Stack.Screen name="index" options={{ headerShown: false }} />
    <Stack.Screen name="welcome" options={{ headerShown: false }} />
    <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    <Stack.Screen name="habits/create" options={{ title: 'New habit' }} />
    <Stack.Screen name="habits/[id]" options={{ title: 'Habit details' }} />
    <Stack.Screen name="habits/edit/[id]" options={{ title: 'Edit habit' }} />
  </Stack></>;
}

function ThemedApp() {
  const db = useSQLiteContext();
  return <ThemeProvider db={db}><ProfileProvider><CloudProvider><AppStack /></CloudProvider></ProfileProvider></ThemeProvider>;
}

export default function RootLayout() {
  const palette = usePalette();
  const [fontsLoaded] = useFonts({
    Fraunces_600SemiBold: require('@expo-google-fonts/fraunces/600SemiBold/Fraunces_600SemiBold.ttf'),
    DMSans_400Regular: require('@expo-google-fonts/dm-sans/400Regular/DMSans_400Regular.ttf'),
    DMSans_500Medium: require('@expo-google-fonts/dm-sans/500Medium/DMSans_500Medium.ttf'),
    DMSans_700Bold: require('@expo-google-fonts/dm-sans/700Bold/DMSans_700Bold.ttf'),
  });
  if (!fontsLoaded) return <ActivityIndicator style={{ flex: 1, backgroundColor: palette.background }} color={palette.purple} />;
  return <SafeAreaProvider><Suspense fallback={<ActivityIndicator style={{ flex: 1 }} color={palette.purple} />}>
    <SQLiteProvider databaseName="doto.db" onInit={migrateDatabase} useSuspense>
      <ThemedApp />
    </SQLiteProvider>
  </Suspense></SafeAreaProvider>;
}
