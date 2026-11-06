import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { type, usePalette } from '@/theme/colors';

export default function TabLayout() {
  const palette = usePalette();
  return <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: palette.accent, tabBarInactiveTintColor: palette.tabInactive, tabBarStyle: { backgroundColor: palette.tab, borderTopWidth: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24, height: 74, paddingTop: 8, paddingBottom: 9 }, tabBarLabelStyle: { fontFamily: type.medium, fontSize: 11 } }}>
    <Tabs.Screen name="home" options={{ title: 'Home', tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" color={typeof color === 'string' ? color : palette.muted} size={size} /> }} />
    <Tabs.Screen name="calendar" options={{ title: 'Calendar', tabBarIcon: ({ color, size }) => <Ionicons name="calendar-outline" color={typeof color === 'string' ? color : palette.muted} size={size} /> }} />
    <Tabs.Screen name="rewards" options={{ title: 'Rewards', tabBarIcon: ({ color, size }) => <Ionicons name="trophy-outline" color={typeof color === 'string' ? color : palette.muted} size={size} /> }} />
    <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" color={typeof color === 'string' ? color : palette.muted} size={size} /> }} />
  </Tabs>;
}
