import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, Text, TextInput, View, type ScrollViewInstance } from 'react-native';
import { ActionButton } from '@/components/ActionButton';
import { Screen } from '@/components/Screen';
import { dailyPlan } from '@/domain/dailyPlan';
import { HABIT_COLORS, localDate, pickHabitIcon } from '@/domain/habitRules';
import { ensureReminderPermission } from '@/notifications/reminders';
import { useHabitStore } from '@/store/useHabitStore';
import { type, usePalette } from '@/theme/colors';
import type { Habit } from '@/types/habit';

function clockDate(time: string): Date {
  const date = new Date();
  const [hour, minute] = time.split(':').map(Number);
  date.setHours(hour ?? 9, minute ?? 0, 0, 0);
  return date;
}

export default function BuildDay() {
  const { habitId } = useLocalSearchParams<{ habitId?: string }>();
  const db = useSQLiteContext();
  const palette = usePalette();
  const habits = useHabitStore((state) => state.habits);
  const refresh = useHabitStore((state) => state.refresh);
  const create = useHabitStore((state) => state.create);
  const update = useHabitStore((state) => state.update);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const selectedFromLink = useRef<string | null>(null);
  const [name, setName] = useState('');
  const [time, setTime] = useState('09:00');
  const [editing, setEditing] = useState<Habit | null>(null);
  const [iosPicker, setIosPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  useFocusEffect(useCallback(() => { void refresh(db); }, [db, refresh]));

  const plan = dailyPlan(habits, localDate(new Date()));
  function choose(habit: Habit) {
    setEditing(habit);
    setName(habit.name);
    setTime(habit.reminder_time ?? '09:00');
    setError(null);
    Keyboard.dismiss();
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }
  useEffect(() => {
    if (!habitId || selectedFromLink.current === habitId) return;
    const habit = habits.find((item) => item.id === habitId);
    if (habit) { selectedFromLink.current = habitId; choose(habit); }
  }, [habitId, habits]);
  function reset() { setEditing(null); setName(''); setTime('09:00'); setError(null); }
  function openTimePicker() {
    Keyboard.dismiss();
    if (Platform.OS === 'android') DateTimePickerAndroid.open({ value: clockDate(time), mode: 'time', onValueChange: (_event, date) => { if (date) setTime(`${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`); } });
    else setIosPicker(true);
  }
  async function save() {
    if (busy) return;
    const title = name.trim().replace(/\s+/g, ' ');
    if (!title) { setError('Give this moment a name.'); return; }
    setBusy(true); setError(null); setNotice(null);
    try {
      const alertsAllowed = await ensureReminderPermission().catch(() => false);
      if (editing) await update(db, editing.id, { ...editing, name: title, reminder_enabled: 1, reminder_time: time });
      else await create(db, { name: title, description: null, icon: pickHabitIcon(title), color: HABIT_COLORS[habits.length % HABIT_COLORS.length]!, created_date: localDate(new Date()), reminder_enabled: 1, reminder_time: time });
      reset();
      setNotice(alertsAllowed ? 'Saved. This moment returns every day.' : 'Saved. Turn on notifications in phone settings for reminders.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save this moment.'); }
    finally { setBusy(false); }
  }
  async function removeTime(habit: Habit) {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      await update(db, habit.id, { ...habit, reminder_enabled: 0, reminder_time: null, reminder_interval_minutes: null, reminder_end_time: null });
      if (editing?.id === habit.id) reset();
      setNotice(`${habit.name} remains in your habits.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not remove this time.'); }
    finally { setBusy(false); }
  }

  function planRow(habit: Habit) {
    return <View key={habit.id} style={[styles.row, { backgroundColor: palette.surface, borderColor: editing?.id === habit.id ? palette.accent : palette.line }]}>
      <Text style={[styles.rowTime, { color: palette.purple }]}>{habit.reminder_time}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${habit.name} at ${habit.reminder_time}`} onPress={() => choose(habit)} style={styles.rowMain}><Text style={[styles.rowName, { color: palette.ink }]} numberOfLines={1}>{habit.name}</Text><Text style={[styles.rowNote, { color: palette.muted }]}>{habit.created_date > localDate(new Date()) ? `Starts ${habit.created_date}` : habit.reminder_interval_minutes ? `Every ${habit.reminder_interval_minutes / 60} hours` : 'Every day'}</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${habit.name} from daily plan`} onPress={() => void removeTime(habit)} disabled={busy} style={styles.remove}><Ionicons name="close" size={20} color={palette.muted} /></Pressable>
    </View>;
  }

  return <Screen topInset={false} scrollRef={scrollRef}>
    <Text style={[styles.title, { color: palette.ink }]}>Shape your <Text style={{ backgroundColor: palette.purpleSoft }}>day.</Text></Text>
    <Text style={[styles.subtitle, { color: palette.muted }]}>Put your moments in place, from morning to night. Each one saves as you add it and returns tomorrow.</Text>
    <View style={[styles.form, { backgroundColor: palette.surface }]}>
      <View style={styles.formHead}><View style={[styles.formIcon, { backgroundColor: palette.purpleSoft }]}><Ionicons name="time-outline" size={22} color={palette.purple} /></View><Text style={[styles.formTitle, { color: palette.ink }]}>{editing ? 'Edit this moment' : 'Add a moment'}</Text></View>
      <Text style={[styles.label, { color: palette.muted }]}>WHAT WILL YOU DO?</Text>
      <TextInput accessibilityLabel="Daily plan moment name" value={name} onChangeText={setName} maxLength={80} returnKeyType="done" onSubmitEditing={Keyboard.dismiss} placeholder="e.g. Take a walk" placeholderTextColor={palette.muted} style={[styles.input, { borderColor: palette.line, color: palette.ink, backgroundColor: palette.surfaceMuted }]} />
      <Text style={[styles.label, { color: palette.muted }]}>WHEN?</Text>
      <View style={styles.presets}>{[{ label: 'Morning', time: '07:00' }, { label: 'Midday', time: '12:00' }, { label: 'Evening', time: '18:00' }].map((item) => <Pressable key={item.time} accessibilityRole="button" accessibilityState={{ selected: time === item.time }} onPress={() => setTime(item.time)} style={[styles.preset, { borderColor: time === item.time ? palette.accent : palette.line, backgroundColor: time === item.time ? palette.purpleSoft : palette.surface }]}><Text style={[styles.presetText, { color: palette.ink }]}>{item.label}</Text></Pressable>)}</View>
      <Pressable accessibilityRole="button" accessibilityLabel={`Choose time, currently ${time}`} onPress={openTimePicker} style={[styles.timePicker, { borderColor: palette.line, backgroundColor: palette.surfaceMuted }]}><Ionicons name="time-outline" size={20} color={palette.purple} /><Text style={[styles.timeText, { color: palette.ink }]}>{new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(clockDate(time))}</Text><Ionicons name="chevron-down" size={18} color={palette.muted} /></Pressable>
      {iosPicker && <View><DateTimePicker value={clockDate(time)} mode="time" display="spinner" onValueChange={(_event, date) => { if (date) setTime(`${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`); }} /><Pressable accessibilityRole="button" onPress={() => setIosPicker(false)} style={styles.donePicker}><Text style={{ color: palette.purple, fontFamily: type.bold }}>Done</Text></Pressable></View>}
      {error && <Text style={[styles.feedback, { color: palette.danger }]}>{error}</Text>}
      {notice && <Text style={[styles.feedback, { color: palette.purple }]}>{notice}</Text>}
      <View style={styles.save}><ActionButton label={busy ? 'Saving...' : editing ? 'Save changes' : 'Add to my day'} onPress={() => void save()} disabled={busy} /></View>
      {editing && <Pressable accessibilityRole="button" accessibilityLabel="Cancel editing" onPress={reset} style={styles.cancel}><Text style={[styles.cancelText, { color: palette.muted }]}>Cancel edit</Text></Pressable>}
    </View>

    <View style={styles.listHead}><Text style={[styles.heading, { color: palette.ink }]}>Your timeline</Text><Text style={[styles.count, { color: palette.muted }]}>{plan.today.length} {plan.today.length === 1 ? 'moment' : 'moments'}</Text></View>
    {plan.today.length ? plan.today.map(planRow) : <Text style={[styles.empty, { color: palette.muted }]}>Your day is open. Add the first moment above.</Text>}
    {plan.upcoming.length > 0 && <><Text style={[styles.heading, { color: palette.ink, marginTop: 26 }]}>Starting later</Text>{plan.upcoming.map(planRow)}</>}
    {plan.untimed.length > 0 && <><Text style={[styles.heading, { color: palette.ink, marginTop: 26 }]}>Bring in an existing habit</Text><Text style={[styles.helper, { color: palette.muted }]}>Tap one, then choose its time above.</Text>{plan.untimed.map((habit) => <Pressable key={habit.id} accessibilityRole="button" accessibilityLabel={`Choose time for ${habit.name}`} onPress={() => choose(habit)} style={[styles.row, { backgroundColor: palette.surface, borderColor: palette.line }]}><Ionicons name={habit.icon as keyof typeof Ionicons.glyphMap} size={22} color={habit.color} /><Text style={[styles.rowName, { color: palette.ink, flex: 1 }]} numberOfLines={1}>{habit.name}</Text><Ionicons name="arrow-up-outline" size={18} color={palette.muted} /></Pressable>)}</>}
    <View style={styles.back}><ActionButton label="See today's plan" secondary onPress={() => router.back()} /></View>
  </Screen>;
}

const styles = StyleSheet.create({
  title: { fontFamily: type.bold, fontSize: 33, letterSpacing: -1, marginTop: 18 }, subtitle: { fontFamily: type.body, fontSize: 14, lineHeight: 21, marginTop: 8 },
  form: { borderRadius: 25, padding: 20, marginTop: 26 }, formHead: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 23 }, formIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, formTitle: { fontFamily: type.bold, fontSize: 18 }, label: { fontFamily: type.bold, fontSize: 10, letterSpacing: 1.2, marginTop: 10, marginBottom: 10 }, input: { borderWidth: 1, borderRadius: 14, minHeight: 54, paddingHorizontal: 15, fontFamily: type.body, fontSize: 15 }, presets: { flexDirection: 'row', gap: 7 }, preset: { flex: 1, borderWidth: 1, minHeight: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, presetText: { fontFamily: type.medium, fontSize: 12 }, timePicker: { borderWidth: 1, borderRadius: 14, minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, marginTop: 10 }, timeText: { flex: 1, fontFamily: type.medium, fontSize: 15 }, donePicker: { alignSelf: 'flex-end', padding: 12 }, feedback: { fontFamily: type.medium, fontSize: 12, lineHeight: 18, marginTop: 13 }, save: { marginTop: 19 }, cancel: { alignSelf: 'center', padding: 12, marginTop: 4 }, cancelText: { fontFamily: type.medium, fontSize: 13 },
  listHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 32, marginBottom: 11 }, heading: { fontFamily: type.bold, fontSize: 21 }, count: { fontFamily: type.medium, fontSize: 12 }, row: { minHeight: 68, borderRadius: 17, borderWidth: 1, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: 9 }, rowTime: { width: 43, fontFamily: type.bold, fontSize: 12 }, rowMain: { flex: 1, paddingVertical: 13 }, rowName: { fontFamily: type.bold, fontSize: 14 }, rowNote: { fontFamily: type.body, fontSize: 12, marginTop: 3 }, remove: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, empty: { fontFamily: type.body, fontSize: 14, lineHeight: 20, marginTop: 12 }, helper: { fontFamily: type.body, fontSize: 12, marginTop: 5 }, back: { marginTop: 30 },
});
