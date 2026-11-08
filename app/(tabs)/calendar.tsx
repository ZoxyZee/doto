import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { localDate } from '@/domain/habitRules';
import { type, usePalette } from '@/theme/colors';

type DayCount = { completion_date: string; count: number };
const weekdays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function Calendar() {
  const db = useSQLiteContext();
  const palette = usePalette();
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selected, setSelected] = useState(localDate(new Date()));
  const [counts, setCounts] = useState<Record<string, number>>({});
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  useFocusEffect(useCallback(() => {
    const prefix = `${year}-${String(monthIndex + 1).padStart(2, '0')}-%`;
    void db.getAllAsync<DayCount>(
      'SELECT completion_date, count(*) AS count FROM habit_completions WHERE completion_date LIKE ? AND is_completed = 1 GROUP BY completion_date', prefix,
    ).then((rows) => setCounts(Object.fromEntries(rows.map((row) => [row.completion_date, row.count]))));
  }, [db, year, monthIndex]));
  const totalDays = new Date(year, monthIndex + 1, 0).getDate();
  const offset = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
  const cells = [...Array(offset).fill(null), ...Array.from({ length: totalDays }, (_, i) => i + 1)] as (number | null)[];
  const label = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(month);
  const selectedCount = counts[selected] ?? 0;
  return <Screen>
    <Text style={[styles.title, { color: palette.ink }]}>Your days.</Text><Text style={[styles.subtitle, { color: palette.muted }]}>Every small step has a place.</Text>
    <View style={styles.monthRow}><Pressable accessibilityRole="button" accessibilityLabel="Previous month" onPress={() => setMonth(new Date(year, monthIndex - 1, 1))} style={styles.nav}><Text style={[styles.navText, { color: palette.purple }]}>‹</Text></Pressable><Text style={[styles.month, { color: palette.ink }]}>{label}</Text><Pressable accessibilityRole="button" accessibilityLabel="Next month" onPress={() => setMonth(new Date(year, monthIndex + 1, 1))} style={styles.nav}><Text style={[styles.navText, { color: palette.purple }]}>›</Text></Pressable></View>
    <View style={styles.grid}>{weekdays.map((day, i) => <Text key={`${day}-${i}`} style={[styles.weekday, { color: palette.muted }]}>{day}</Text>)}
      {cells.map((day, index) => {
        const date = day ? `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` : '';
        const active = selected === date;
        const hasActivity = !!counts[date];
        return <View key={index} style={styles.cell}>{day && <Pressable accessibilityRole="button" accessibilityLabel={`${date}, ${counts[date] ?? 0} habits completed`} onPress={() => setSelected(date)} style={[styles.day, active && { backgroundColor: palette.purple }]}><Text style={[styles.dayText, { color: active ? palette.onPrimary : palette.ink }]}>{day}</Text>{hasActivity && <View style={[styles.dot, { backgroundColor: active ? palette.onPrimary : palette.accent }]} />}</Pressable>}</View>;
      })}</View>
    <View style={[styles.summary, { borderColor: palette.line }]}><Text style={[styles.summaryDate, { color: palette.ink }]}>{selected}</Text><Text style={[styles.summaryText, { color: palette.muted }]}>{selectedCount > 0 ? `${selectedCount} ${selectedCount === 1 ? 'habit' : 'habits'} completed` : 'No completions recorded'}</Text></View>
    <Text style={[styles.footnote, { color: palette.muted }]}>Dots show any recorded activity. Your streak grows when all due habits are complete.</Text>
  </Screen>;
}
const styles = StyleSheet.create({ title: { fontFamily: type.display, fontSize: 31, marginTop: 18 }, subtitle: { fontFamily: type.body, fontSize: 15, marginTop: 7 }, monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 36, marginBottom: 18 }, month: { fontFamily: type.bold, fontSize: 17 }, nav: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, navText: { fontFamily: type.body, fontSize: 32, lineHeight: 38 }, grid: { flexDirection: 'row', flexWrap: 'wrap' }, weekday: { width: '14.2857%', textAlign: 'center', fontFamily: type.bold, fontSize: 12, paddingBottom: 13 }, cell: { width: '14.2857%', height: 52, alignItems: 'center', justifyContent: 'center' }, day: { width: 42, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }, dayText: { fontFamily: type.medium, fontSize: 15 }, dot: { width: 4, height: 4, borderRadius: 2, marginTop: 2 }, summary: { borderTopWidth: 1, borderBottomWidth: 1, paddingVertical: 18, marginTop: 30 }, summaryDate: { fontFamily: type.bold, fontSize: 16 }, summaryText: { fontFamily: type.body, fontSize: 14, marginTop: 5 }, footnote: { fontFamily: type.body, fontSize: 12, lineHeight: 18, marginTop: 18 } });
