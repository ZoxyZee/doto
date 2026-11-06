import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { ActionButton } from '@/components/ActionButton';
import { Screen } from '@/components/Screen';
import { getHabit } from '@/database/habitRepository';
import { useHabitStore } from '@/store/useHabitStore';
import { type, usePalette } from '@/theme/colors';
import type { Habit } from '@/types/habit';

export default function HabitDetails() {
  const palette = usePalette();
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const archive = useHabitStore((state) => state.archive);
  const remove = useHabitStore((state) => state.remove);
  const [habit, setHabit] = useState<Habit | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (id) void getHabit(db, id).then(setHabit); }, [db, id]);
  async function toggleArchive() {
    if (!habit) return;
    try { await archive(db, habit.id, !habit.archived_at); router.back(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not update habit.'); }
  }
  function confirmDelete() {
    if (!habit) return;
    Alert.alert('Delete this habit?', 'This removes it from your list. Its record is retained for future synchronization.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { void remove(db, habit.id).then(() => router.back()).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Could not delete habit.')); } },
    ]);
  }
  if (!habit) return <Screen topInset={false}><Text style={[styles.muted, { color: palette.muted }]}>Loading habit…</Text></Screen>;
  return <Screen topInset={false}>
    <View style={[styles.icon, { backgroundColor: `${habit.color}22` }]}><Ionicons name={habit.icon as keyof typeof Ionicons.glyphMap} color={habit.color} size={42} /></View>
    <Text style={[styles.title, { color: palette.ink }]}>{habit.name}</Text>
    {habit.description && <Text style={[styles.description, { color: palette.muted }]}>{habit.description}</Text>}
    <View style={[styles.info, { borderColor: palette.line }]}><View style={styles.infoRow}><Text style={[styles.infoLabel, { color: palette.muted }]}>Status</Text><Text style={[styles.infoValue, { color: palette.ink }]}>{habit.archived_at ? 'Archived' : 'Active'}</Text></View><View style={styles.infoRow}><Text style={[styles.infoLabel, { color: palette.muted }]}>Starts</Text><Text style={[styles.infoValue, { color: palette.ink }]}>{habit.created_date}</Text></View><View style={styles.infoRow}><Text style={[styles.infoLabel, { color: palette.muted }]}>Reminder</Text><Text style={[styles.infoValue, { color: palette.ink }]}>{habit.reminder_enabled && habit.reminder_time ? habit.reminder_time : 'Off'}</Text></View></View>
    <View style={styles.buttons}><ActionButton label="Edit habit" onPress={() => router.push({ pathname: '/habits/edit/[id]', params: { id: habit.id } })} /><View style={styles.gap} /><ActionButton label={habit.archived_at ? 'Restore habit' : 'Archive habit'} secondary onPress={() => void toggleArchive()} /></View>
    <Text style={[styles.delete, { color: palette.danger }]} onPress={confirmDelete}>Delete habit</Text>
    {error && <Text style={[styles.error, { color: palette.danger }]}>{error}</Text>}
  </Screen>;
}
const styles = StyleSheet.create({ icon: { width: 76, height: 76, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginTop: 22 }, title: { fontFamily: type.display, fontSize: 33, marginTop: 20 }, description: { fontFamily: type.body, fontSize: 16, marginTop: 8, lineHeight: 23 }, info: { borderTopWidth: 1, borderBottomWidth: 1, paddingVertical: 8, marginTop: 28 }, infoRow: { minHeight: 52, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, infoLabel: { fontFamily: type.medium, fontSize: 14 }, infoValue: { fontFamily: type.bold, fontSize: 14 }, buttons: { marginTop: 28 }, gap: { height: 10 }, delete: { fontFamily: type.bold, textAlign: 'center', marginTop: 28, padding: 12 }, muted: { fontFamily: type.body }, error: { fontFamily: type.medium, marginTop: 16 } });
