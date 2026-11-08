import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { StyleSheet, Text } from 'react-native';
import { HabitForm } from '@/components/HabitForm';
import { Screen } from '@/components/Screen';
import { useHabitStore } from '@/store/useHabitStore';
import { type, usePalette } from '@/theme/colors';

export default function CreateHabit() {
  const palette = usePalette();
  const db = useSQLiteContext();
  const create = useHabitStore((state) => state.create);
  return <Screen topInset={false}><Text style={[styles.title, { color: palette.ink }]}>Make it <Text style={{ backgroundColor: palette.purpleSoft }}>yours.</Text></Text><Text style={[styles.subtitle, { color: palette.muted }]}>A small action you can return to each day.</Text>
    <HabitForm submitLabel="Create habit" onSubmit={async (input) => { await create(db, input); router.back(); }} />
  </Screen>;
}
const styles = StyleSheet.create({ title: { fontFamily: type.bold, fontSize: 31, letterSpacing: -0.9, marginTop: 18 }, subtitle: { fontFamily: type.body, fontSize: 14, lineHeight: 21, marginTop: 8 } });
