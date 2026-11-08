import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ActionButton } from '@/components/ActionButton';
import { CloudAccount } from '@/components/CloudAccount';
import { HabitCard } from '@/components/HabitCard';
import { Screen } from '@/components/Screen';
import { useHabitStore } from '@/store/useHabitStore';
import { type, usePalette, useTheme, type ThemeMode } from '@/theme/colors';
import { useProfile } from '@/profile/ProfileProvider';

export default function Settings() {
  const palette = usePalette();
  const theme = useTheme();
  const profile = useProfile();
  const [nameDraft, setNameDraft] = useState(profile.name ?? '');
  useEffect(() => { setNameDraft(profile.name ?? ''); }, [profile.name]);
  const db = useSQLiteContext();
  const archived = useHabitStore((state) => state.archived);
  const refresh = useHabitStore((state) => state.refresh);
  useEffect(() => { void refresh(db); }, [db, refresh, archived.length]);
  return <Screen><Text style={[styles.title, { color: palette.ink }]}>Your space.</Text><Text style={[styles.subtitle, { color: palette.muted }]}>The little things behind your days.</Text>
    <Text style={[styles.heading, { color: palette.ink }]}>Account</Text>
    <View style={[styles.group, { borderColor: palette.line }]}><Text style={[styles.rowTitle, { color: palette.ink }]}>Your name</Text><TextInput accessibilityLabel="Your name" autoCapitalize="words" maxLength={32} value={nameDraft} onChangeText={setNameDraft} style={{ borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surface, color: palette.ink, borderRadius: 12, minHeight: 46, paddingHorizontal: 13, marginTop: 10, fontFamily: type.medium, fontSize: 14 }} /><View style={{ marginTop: 12 }}><ActionButton label="Save name" secondary onPress={() => { void profile.setName(nameDraft).catch((cause) => Alert.alert('Could not save name', cause instanceof Error ? cause.message : 'Please try again.')); }} /></View></View>
    <CloudAccount />
    <Text style={[styles.heading, { color: palette.ink }]}>Preferences</Text>
    <View style={[styles.group, { borderColor: palette.line }]}><Text style={[styles.rowTitle, { color: palette.ink }]}>Appearance</Text><View style={styles.themeChoices}>{(['system', 'light', 'dark'] as ThemeMode[]).map((mode) => <Pressable key={mode} accessibilityRole="radio" accessibilityState={{ selected: theme?.mode === mode }} accessibilityLabel={`${mode === 'system' ? 'System' : mode === 'light' ? 'Light' : 'Dark'} theme`} onPress={() => { void theme?.setMode(mode).catch(() => Alert.alert('Could not save appearance', 'Please try again.')); }} style={[styles.themeChoice, { backgroundColor: theme?.mode === mode ? palette.purple : palette.surfaceMuted, borderColor: palette.line }]}><Text style={[styles.themeChoiceText, { color: theme?.mode === mode ? palette.onPrimary : palette.ink }]}>{mode === 'system' ? 'System' : mode === 'light' ? 'Light' : 'Dark'}</Text></Pressable>)}</View></View>
    <Text style={[styles.heading, { color: palette.ink }]}>Archived habits</Text>{archived.length ? <View style={{ borderTopWidth: 1, borderColor: palette.line }}>{archived.map((habit) => <HabitCard key={habit.id} habit={habit} />)}</View> : <Text style={[styles.note, { color: palette.muted }]}>Nothing archived. Your current habits are on Home.</Text>}
    <View style={{ marginTop: 32 }}><ActionButton label="About DOTO" secondary onPress={() => Alert.alert('DOTO', 'Small Steps. Big Streaks.')} /></View>
  </Screen>;
}
const styles = StyleSheet.create({ title: { fontFamily: type.display, fontSize: 31, marginTop: 18 }, subtitle: { fontFamily: type.body, marginTop: 7, fontSize: 15 }, group: { borderTopWidth: 1, borderBottomWidth: 1, paddingVertical: 15 }, row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 30 }, rowTitle: { fontFamily: type.bold, fontSize: 15 }, rowAside: { fontFamily: type.medium, fontSize: 12 }, note: { fontFamily: type.body, marginTop: 8, lineHeight: 20, fontSize: 13 }, heading: { fontFamily: type.display, fontSize: 22, marginTop: 35, marginBottom: 14 }, themeChoices: { flexDirection: 'row', gap: 9, marginTop: 13 }, themeChoice: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 42, borderRadius: 12, borderWidth: 1 }, themeChoiceText: { fontFamily: type.bold, fontSize: 13 } });
