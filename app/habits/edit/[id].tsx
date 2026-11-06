import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { HabitForm } from '@/components/HabitForm';
import { Screen } from '@/components/Screen';
import { getHabit } from '@/database/habitRepository';
import { useHabitStore } from '@/store/useHabitStore';
import { type, usePalette } from '@/theme/colors';
import type { Habit } from '@/types/habit';

export default function EditHabit() {
  const palette = usePalette();
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const update = useHabitStore((state) => state.update);
  const [habit, setHabit] = useState<Habit | null>(null);
  useEffect(() => { if (id) void getHabit(db, id).then(setHabit); }, [db, id]);
  return <Screen topInset={false}><Text style={[styles.title, { color: palette.ink }]}>Shape your habit.</Text>
    {habit ? <HabitForm initial={habit} submitLabel="Save changes" onSubmit={async (input) => { await update(db, habit.id, input); router.back(); }} /> : <Text style={[styles.muted, { color: palette.muted }]}>Loading habit…</Text>}
  </Screen>;
}
const styles = StyleSheet.create({ title: { fontFamily: type.display, fontSize: 31, marginTop: 18 }, muted: { fontFamily: type.body, marginTop: 20 } });
