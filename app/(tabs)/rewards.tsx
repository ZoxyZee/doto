import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { type, usePalette } from '@/theme/colors';

export default function Rewards() {
  const db = useSQLiteContext();
  const palette = usePalette();
  const [steps, setSteps] = useState(0);
  useFocusEffect(useCallback(() => { void db.getFirstAsync<{ count: number }>('SELECT count(*) AS count FROM habit_completions WHERE is_completed = 1').then((row) => setSteps(row?.count ?? 0)); }, [db]));
  return <Screen><Text style={[styles.title, { color: palette.ink }]}>Your momentum.</Text><Text style={[styles.subtitle, { color: palette.muted }]}>Built one day at a time.</Text>
    <View style={[styles.numberBlock, { borderBottomColor: palette.line }]}><Text style={[styles.number, { color: palette.purple }]}>{steps}</Text><Text style={[styles.numberLabel, { color: palette.ink }]}>{steps === 1 ? 'step recorded' : 'steps recorded'}</Text></View>
    <Text style={[styles.heading, { color: palette.ink }]}>More to come</Text><Text style={[styles.body, { color: palette.muted }]}>Streaks, XP, and milestones will grow from the steps you record. Your progress is already saved on this device.</Text>
    <View style={styles.milestones}><View style={[styles.milestoneDot, { backgroundColor: palette.accent }]} /><View style={[styles.milestoneLine, { backgroundColor: palette.line }]} /><View style={[styles.milestoneDot, { backgroundColor: palette.line }]} /><View style={[styles.milestoneLine, { backgroundColor: palette.line }]} /><View style={[styles.milestoneDot, { backgroundColor: palette.line }]} /></View>
    <View style={styles.labels}><Text style={[styles.milestoneLabel, { color: palette.muted }]}>Start</Text><Text style={[styles.milestoneLabel, { color: palette.muted }]}>7 days</Text><Text style={[styles.milestoneLabel, { color: palette.muted }]}>30 days</Text></View>
  </Screen>;
}
const styles = StyleSheet.create({ title: { fontFamily: type.display, fontSize: 31, marginTop: 18 }, subtitle: { fontFamily: type.body, fontSize: 15, marginTop: 7 }, numberBlock: { marginTop: 46, paddingBottom: 30, borderBottomWidth: 1 }, number: { fontFamily: type.display, fontSize: 72, lineHeight: 82 }, numberLabel: { fontFamily: type.bold, fontSize: 17 }, heading: { fontFamily: type.display, fontSize: 23, marginTop: 34 }, body: { fontFamily: type.body, fontSize: 15, lineHeight: 23, marginTop: 10 }, milestones: { flexDirection: 'row', alignItems: 'center', marginTop: 42 }, milestoneDot: { width: 14, height: 14, borderRadius: 7 }, milestoneLine: { flex: 1, height: 2 }, labels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 11 }, milestoneLabel: { fontFamily: type.medium, fontSize: 12 } });
