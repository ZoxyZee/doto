import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { HabitCard } from '@/components/HabitCard';
import { Screen } from '@/components/Screen';
import { dailyPlan } from '@/domain/dailyPlan';
import { localDate } from '@/domain/habitRules';
import { useHabitStore } from '@/store/useHabitStore';
import { type, usePalette } from '@/theme/colors';

export default function Schedule() {
  const db = useSQLiteContext();
  const palette = usePalette();
  const habits = useHabitStore((state) => state.habits);
  const today = useHabitStore((state) => state.today);
  const loading = useHabitStore((state) => state.loading);
  const error = useHabitStore((state) => state.error);
  const refresh = useHabitStore((state) => state.refresh);
  const complete = useHabitStore((state) => state.complete);
  const [now, setNow] = useState(() => new Date());
  const [actionError, setActionError] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    let activeDate = localDate(new Date());
    setNow(new Date());
    void refresh(db);
    const clock = setInterval(() => {
      const current = new Date();
      setNow(current);
      if (localDate(current) !== activeDate) {
        activeDate = localDate(current);
        void refresh(db);
      }
    }, 60_000);
    return () => clearInterval(clock);
  }, [db, refresh]));

  const date = localDate(now);
  const plan = dailyPlan(habits, date);
  const completed = plan.today.filter((habit) => today.completedIds.includes(habit.id)).length;
  const currentTime = now.toTimeString().slice(0, 5);
  const next = plan.today.find((habit) => !today.completedIds.includes(habit.id) && habit.reminder_time! >= currentTime)
    ?? plan.today.find((habit) => !today.completedIds.includes(habit.id));
  const dateLabel = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(now);
  const add = () => router.push('/plan');

  return <Screen>
    <View style={styles.topline}><Text style={[styles.eyebrow, { color: palette.purple }]}>YOUR DAILY PLAN</Text><View style={[styles.repeatPill, { backgroundColor: palette.purpleSoft }]}><Ionicons name="repeat-outline" size={14} color={palette.purple} /><Text style={[styles.repeatText, { color: palette.purple }]}>Every day</Text></View></View>
    <Text style={[styles.title, { color: palette.ink }]}>A day that feels <Text style={{ backgroundColor: palette.purpleSoft }}>yours.</Text></Text>
    <Text style={[styles.subtitle, { color: palette.muted }]}>{dateLabel} · Set the moments you want to return to.</Text>

    <View style={[styles.summary, { backgroundColor: palette.surface }]}>
      <View style={styles.summaryTop}><View><Text style={[styles.summaryLabel, { color: palette.muted }]}>TODAY'S FLOW</Text><Text style={[styles.summaryCount, { color: palette.ink }]}>{completed}<Text style={{ color: palette.muted }}> / {plan.today.length}</Text></Text></View><View style={[styles.summaryIcon, { backgroundColor: palette.purpleSoft }]}><Ionicons name="sunny-outline" size={26} color={palette.purple} /></View></View>
      <View style={[styles.track, { backgroundColor: palette.progressTrack }]}><View style={[styles.fill, { backgroundColor: palette.accent, width: `${plan.today.length ? completed / plan.today.length * 100 : 0}%` }]} /></View>
      <Text style={[styles.summaryHint, { color: palette.muted }]}>{next ? `${next.reminder_time! >= currentTime ? 'Up next' : 'Still to do'}: ${next.name} · ${next.reminder_time}` : plan.today.length ? 'Your planned moments are done for today.' : 'Start by giving one habit a time.'}</Text>
    </View>

    <Pressable accessibilityRole="button" accessibilityLabel="Build or edit your whole day" onPress={add} style={[styles.builderLink, { backgroundColor: palette.purpleSoft }]}><View style={styles.builderCopy}><Text style={[styles.builderTitle, { color: palette.ink }]}>Build your whole day</Text><Text style={[styles.builderNote, { color: palette.muted }]}>Add and adjust all your daily moments</Text></View><Ionicons name="arrow-forward" size={21} color={palette.purple} /></Pressable>
    <View style={styles.sectionHead}><View><Text style={[styles.eyebrow, { color: palette.purple }]}>FROM MORNING TO NIGHT</Text><Text style={[styles.heading, { color: palette.ink }]}>Today's timeline</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Add to daily plan" onPress={add} style={[styles.add, { backgroundColor: palette.accent }]}><Ionicons name="add" size={24} color={palette.inverse} /></Pressable></View>

    {loading ? <ActivityIndicator color={palette.purple} /> : error ? <Text style={[styles.error, { color: palette.danger }]}>{error}</Text> : plan.today.length ?
      <View>{plan.today.map((habit, index) => <View key={habit.id} style={styles.timelineRow}>
        <View style={styles.timeRail}><Text style={[styles.time, { color: palette.ink }]}>{habit.reminder_time}</Text><View style={[styles.railDot, { backgroundColor: next?.id === habit.id ? palette.accent : palette.line }]} />{index < plan.today.length - 1 && <View style={[styles.railLine, { backgroundColor: palette.line }]} />}</View>
        <View style={[styles.event, { backgroundColor: palette.surface, borderColor: next?.id === habit.id ? palette.accent : palette.line }]}>
          <HabitCard habit={habit} completed={today.completedIds.includes(habit.id)} onToggle={async () => { try { setActionError(null); await complete(db, habit.id, !today.completedIds.includes(habit.id)); } catch (cause) { setActionError(cause instanceof Error ? cause.message : 'Could not save this moment.'); } }} />
          {habit.reminder_interval_minutes && habit.reminder_end_time && <Text style={[styles.repeatHint, { color: palette.muted }]}>Repeats every {habit.reminder_interval_minutes / 60}h until {habit.reminder_end_time}</Text>}
        </View>
      </View>)}</View> : <View style={[styles.empty, { backgroundColor: palette.surface }]}><Ionicons name="time-outline" size={34} color={palette.purple} /><Text style={[styles.emptyTitle, { color: palette.ink }]}>Make space for your day.</Text><Text style={[styles.emptyBody, { color: palette.muted }]}>Add a habit and choose a time. It will return here each day.</Text><Pressable accessibilityRole="button" onPress={add} style={[styles.emptyButton, { backgroundColor: palette.accent }]}><Text style={[styles.emptyButtonText, { color: palette.inverse }]}>Add your first moment</Text></Pressable></View>}

    {plan.upcoming.length > 0 && <View style={styles.extraSection}><Text style={[styles.heading, { color: palette.ink }]}>Starting soon</Text>{plan.upcoming.map((habit) => <View key={habit.id} style={[styles.extraCard, { backgroundColor: palette.surface }]}><Text style={[styles.extraTime, { color: palette.purple }]}>{habit.reminder_time}</Text><View style={styles.extraCopy}><Text style={[styles.extraName, { color: palette.ink }]}>{habit.name}</Text><Text style={[styles.extraNote, { color: palette.muted }]}>Starts {habit.created_date}</Text></View></View>)}</View>}
    {plan.untimed.length > 0 && <View style={styles.extraSection}><Text style={[styles.heading, { color: palette.ink }]}>Give these a time</Text><Text style={[styles.extraNote, { color: palette.muted, marginTop: 5, marginBottom: 8 }]}>Your other habits can join the daily plan too.</Text>{plan.untimed.map((habit) => <Pressable key={habit.id} accessibilityRole="button" accessibilityLabel={`Set time for ${habit.name}`} onPress={() => router.push({ pathname: '/plan', params: { habitId: habit.id } })} style={[styles.extraCard, { backgroundColor: palette.surface }]}><Ionicons name={habit.icon as keyof typeof Ionicons.glyphMap} size={22} color={habit.color} /><View style={styles.extraCopy}><Text style={[styles.extraName, { color: palette.ink }]} numberOfLines={1}>{habit.name}</Text><Text style={[styles.extraNote, { color: palette.muted }]}>Set a daily time</Text></View><Ionicons name="chevron-forward" size={18} color={palette.muted} /></Pressable>)}</View>}
    {actionError && <Text style={[styles.error, { color: palette.danger }]}>{actionError}</Text>}
  </Screen>;
}

const styles = StyleSheet.create({
  topline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }, eyebrow: { fontFamily: type.bold, fontSize: 10, letterSpacing: 1.3 }, repeatPill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 13, paddingHorizontal: 10, paddingVertical: 7 }, repeatText: { fontFamily: type.medium, fontSize: 11 },
  title: { fontFamily: type.bold, fontSize: 32, lineHeight: 38, letterSpacing: -1.1, marginTop: 24 }, subtitle: { fontFamily: type.body, fontSize: 13, lineHeight: 19, marginTop: 8 },
  summary: { borderRadius: 24, padding: 21, marginTop: 26 }, summaryTop: { flexDirection: 'row', justifyContent: 'space-between' }, summaryLabel: { fontFamily: type.bold, fontSize: 10, letterSpacing: 1.2 }, summaryCount: { fontFamily: type.bold, fontSize: 32, marginTop: 10 }, summaryIcon: { width: 50, height: 50, borderRadius: 17, alignItems: 'center', justifyContent: 'center' }, track: { height: 9, borderRadius: 8, overflow: 'hidden', marginTop: 16 }, fill: { height: 9, borderRadius: 8 }, summaryHint: { fontFamily: type.body, fontSize: 13, lineHeight: 18, marginTop: 12 },
  builderLink: { borderRadius: 18, minHeight: 72, paddingHorizontal: 18, marginTop: 15, flexDirection: 'row', alignItems: 'center', gap: 10 }, builderCopy: { flex: 1 }, builderTitle: { fontFamily: type.bold, fontSize: 15 }, builderNote: { fontFamily: type.body, fontSize: 12, marginTop: 4 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 33, marginBottom: 17 }, heading: { fontFamily: type.bold, fontSize: 21, letterSpacing: -0.5, marginTop: 4 }, add: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  timelineRow: { flexDirection: 'row', gap: 10, minHeight: 91 }, timeRail: { width: 52, alignItems: 'center', paddingTop: 19 }, time: { fontFamily: type.bold, fontSize: 12 }, railDot: { width: 8, height: 8, borderRadius: 4, marginTop: 10 }, railLine: { width: 2, flex: 1, marginTop: 4, marginBottom: -4 }, event: { flex: 1, borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, marginBottom: 10, overflow: 'hidden' }, repeatHint: { fontFamily: type.body, fontSize: 11, paddingBottom: 12, paddingLeft: 2 },
  empty: { borderRadius: 24, padding: 24, alignItems: 'flex-start' }, emptyTitle: { fontFamily: type.bold, fontSize: 21, marginTop: 16 }, emptyBody: { fontFamily: type.body, fontSize: 14, lineHeight: 21, marginTop: 7 }, emptyButton: { borderRadius: 14, paddingHorizontal: 17, paddingVertical: 13, marginTop: 21 }, emptyButtonText: { fontFamily: type.bold, fontSize: 13 },
  extraSection: { marginTop: 26 }, extraCard: { minHeight: 67, borderRadius: 17, marginTop: 9, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }, extraTime: { fontFamily: type.bold, fontSize: 13, width: 45 }, extraCopy: { flex: 1 }, extraName: { fontFamily: type.bold, fontSize: 14 }, extraNote: { fontFamily: type.body, fontSize: 12, marginTop: 3 }, error: { fontFamily: type.medium, fontSize: 13, marginTop: 16 },
});
