import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { ActionButton } from '@/components/ActionButton';
import { HabitCard } from '@/components/HabitCard';
import { Screen } from '@/components/Screen';
import { localDate } from '@/domain/habitRules';
import { useHabitStore } from '@/store/useHabitStore';
import { type, usePalette } from '@/theme/colors';

export default function Home() {
  const db = useSQLiteContext();
  const palette = usePalette();
  const habits = useHabitStore((state) => state.habits);
  const loading = useHabitStore((state) => state.loading);
  const error = useHabitStore((state) => state.error);
  const today = useHabitStore((state) => state.today);
  const complete = useHabitStore((state) => state.complete);
  const refresh = useHabitStore((state) => state.refresh);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  useFocusEffect(useCallback(() => { void refresh(db); }, [db, refresh]));
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => subscription.remove();
  }, []);
  const ratio = today.requiredCount ? today.completedCount / today.requiredCount : 0;
  const todayKey = localDate(new Date());
  const activeHabits = habits.filter((habit) => habit.created_date <= todayKey);
  const upcomingHabits = habits.filter((habit) => habit.created_date > todayKey).sort((a, b) => a.created_date.localeCompare(b.created_date));
  const nextHabit = activeHabits.find((habit) => !today.completedIds.includes(habit.id));
  useEffect(() => {
    if (reduceMotion) progress.setValue(ratio);
    else Animated.timing(progress, { toValue: ratio, duration: 260, useNativeDriver: false }).start();
  }, [progress, ratio, reduceMotion]);
  const date = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date());
  const message = today.requiredCount === 0 ? upcomingHabits.length ? 'Your next routine starts soon.' : 'Start with one small thing.' : today.completedCount === today.requiredCount ? 'All done for today. See you tomorrow.' : nextHabit ? `Next up: ${nextHabit.name}` : 'One step at a time.';
  return <Screen>
    <View style={styles.brandRow}><Text style={[styles.brand, { color: palette.ink }]}>doto<Text style={{ color: palette.accent }}>.</Text></Text><View style={[styles.datePill, { backgroundColor: palette.surfaceMuted }]}><Ionicons name="calendar-outline" size={15} color={palette.ink} /><Text style={[styles.date, { color: palette.ink }]}>{date}</Text></View></View>
    <Text style={[styles.title, { color: palette.ink }]}>A little every day.</Text>
    <Text style={[styles.subtitle, { color: palette.muted }]}>Keep the things that matter moving.</Text>
    <View style={[styles.progressCard, { backgroundColor: palette.surface }]}>
      <View style={styles.progressTop}><Text style={[styles.progressLabel, { color: palette.muted }]}>TODAY’S PROGRESS</Text><View style={[styles.progressBadge, { backgroundColor: palette.purpleSoft }]}><Text style={[styles.progressBadgeText, { color: palette.purple }]}>{Math.round(ratio * 100)}%</Text></View></View>
      <View style={styles.progressNumbers}><Text style={[styles.bigCount, { color: palette.ink }]}>{today.completedCount}<Text style={[styles.totalCount, { color: palette.muted }]}> / {today.requiredCount}</Text></Text><Text style={[styles.countCaption, { color: palette.muted }]}>habits done</Text></View>
      <View style={[styles.track, { backgroundColor: palette.progressTrack }]}><Animated.View style={[styles.fill, { backgroundColor: palette.accent, width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} /></View>
      <Text style={[styles.message, { color: palette.muted }]}>{message}</Text>
    </View>
    <View style={styles.section}><View><Text style={[styles.sectionOverline, { color: palette.purple }]}>YOUR ROUTINE</Text><Text style={[styles.heading, { color: palette.ink }]}>Today’s habits</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Add habit" onPress={() => router.push('/habits/create')} style={[styles.add, { backgroundColor: palette.accent }]}><Ionicons name="add" size={24} color={palette.inverse} /></Pressable></View>
    {loading ? <ActivityIndicator color={palette.purple} /> : error ? <Text style={[styles.error, { color: palette.danger }]}>{error}</Text> : habits.length === 0 ?
      <View style={[styles.empty, { backgroundColor: palette.surface }]}><View style={[styles.emptyMark, { borderColor: palette.accent }]}><View style={[styles.emptyDot, { backgroundColor: palette.accent }]} /></View><Text style={[styles.emptyTitle, { color: palette.ink }]}>Start with one thing.</Text><Text style={[styles.emptyBody, { color: palette.muted }]}>What would you like to make room for each day?</Text><View style={styles.emptyAction}><ActionButton label="Create a habit" onPress={() => router.push('/habits/create')} /></View></View> :
      activeHabits.length ? <View style={[styles.list, { backgroundColor: palette.surface }]}>{activeHabits.map((habit) => <HabitCard key={habit.id} habit={habit} completed={today.completedIds.includes(habit.id)} onToggle={async () => { try { setActionError(null); await complete(db, habit.id, !today.completedIds.includes(habit.id)); } catch (cause) { setActionError(cause instanceof Error ? cause.message : 'Could not save this step. Please try again.'); } }} />)}</View> :
      <View style={[styles.empty, { backgroundColor: palette.surface }]}><Text style={[styles.emptyTitle, { color: palette.ink, marginTop: 0 }]}>A little room to breathe.</Text><Text style={[styles.emptyBody, { color: palette.muted }]}>Nothing is due today. Your planned habits are waiting below.</Text></View>}
    {upcomingHabits.length > 0 && <><View style={styles.upcomingHeader}><Text style={[styles.sectionOverline, { color: palette.purple }]}>COMING UP</Text><Text style={[styles.upcomingCount, { color: palette.muted }]}>{upcomingHabits.length} planned</Text></View><View style={[styles.list, { backgroundColor: palette.surface }]}>{upcomingHabits.map((habit) => <HabitCard key={habit.id} habit={habit} />)}</View></>}
    {actionError && <Text style={[styles.error, { color: palette.danger }]}>{actionError}</Text>}
    {habits.length > 0 && <Pressable onPress={() => router.push('/habits/create')} style={styles.more}><Ionicons name="add-circle-outline" size={19} color={palette.purple} /><Text style={[styles.moreText, { color: palette.purple }]}>Add another habit</Text></Pressable>}
  </Screen>;
}
const styles = StyleSheet.create({ brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }, brand: { fontFamily: type.bold, fontSize: 28, letterSpacing: -1.3 }, datePill: { flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 14, paddingHorizontal: 12, minHeight: 40 }, date: { fontFamily: type.medium, fontSize: 12 }, title: { fontFamily: type.bold, fontSize: 34, lineHeight: 41, marginTop: 36, letterSpacing: -1.2 }, subtitle: { fontFamily: type.body, fontSize: 15, marginTop: 6 }, progressCard: { borderRadius: 28, padding: 21, marginTop: 27 }, progressTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, progressLabel: { fontFamily: type.bold, fontSize: 11, letterSpacing: 1.1 }, progressBadge: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 13 }, progressBadgeText: { fontFamily: type.bold, fontSize: 13 }, progressNumbers: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 22 }, bigCount: { fontFamily: type.bold, fontSize: 37, letterSpacing: -1.5 }, totalCount: { fontFamily: type.medium, fontSize: 25 }, countCaption: { fontFamily: type.medium, fontSize: 14 }, track: { height: 11, borderRadius: 9, overflow: 'hidden', marginTop: 19 }, fill: { height: 11, borderRadius: 9 }, message: { fontFamily: type.body, fontSize: 13, marginTop: 13 }, section: { marginTop: 34, marginBottom: 13, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, sectionOverline: { fontFamily: type.bold, fontSize: 10, letterSpacing: 1.3, marginBottom: 4 }, heading: { fontFamily: type.bold, fontSize: 22, letterSpacing: -0.5 }, add: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }, list: { borderRadius: 24, overflow: 'hidden', paddingHorizontal: 16 }, upcomingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 28, marginBottom: 10 }, upcomingCount: { fontFamily: type.medium, fontSize: 12 }, empty: { alignItems: 'flex-start', borderRadius: 24, padding: 24 }, emptyMark: { width: 48, height: 48, borderRadius: 16, borderWidth: 2, alignItems: 'flex-end', justifyContent: 'flex-start', padding: 8 }, emptyDot: { width: 12, height: 12, borderRadius: 6 }, emptyTitle: { fontFamily: type.bold, fontSize: 22, marginTop: 24 }, emptyBody: { fontFamily: type.body, fontSize: 15, lineHeight: 22, marginTop: 8 }, emptyAction: { marginTop: 22, alignSelf: 'stretch' }, error: { fontFamily: type.medium, marginTop: 14 }, more: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 50, marginTop: 16 }, moreText: { fontFamily: type.bold, fontSize: 14 } });
