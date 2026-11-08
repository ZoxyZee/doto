import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ActionButton } from '@/components/ActionButton';
import { HabitGuidance } from '@/components/HabitGuidance';
import { HABIT_COLORS, localDate, pickHabitIcon } from '@/domain/habitRules';
import { reminderTimes } from '@/domain/reminderSchedule';
import { ensureReminderPermission } from '@/notifications/reminders';
import { type, usePalette } from '@/theme/colors';
import type { HabitInput } from '@/types/habit';

const starterIdeas = [
  { label: 'Read 10 min', name: 'Read for 10 minutes', color: HABIT_COLORS[2] },
  { label: 'Take a walk', name: 'Take a 15-minute walk', color: HABIT_COLORS[1] },
  { label: 'Drink water', name: 'Drink a glass of water', color: HABIT_COLORS[0] },
  { label: 'Stretch', name: 'Stretch for 5 minutes', color: HABIT_COLORS[3] },
  { label: 'Journal', name: 'Write in my journal', color: HABIT_COLORS[4] },
  { label: 'Meditate', name: 'Meditate for 5 minutes', color: HABIT_COLORS[1] },
  { label: 'Sleep early', name: 'Go to bed on time', color: HABIT_COLORS[4] },
  { label: 'Learn a word', name: 'Learn one new word', color: HABIT_COLORS[2] },
  { label: 'Tidy up', name: 'Tidy up for 10 minutes', color: HABIT_COLORS[3] },
  { label: 'Plan tomorrow', name: 'Plan tomorrow', color: HABIT_COLORS[0] },
] as const;

function pickStarterIdeas() {
  const shuffled = [...starterIdeas];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    const selected = shuffled[index]!;
    shuffled[index] = shuffled[randomIndex]!;
    shuffled[randomIndex] = selected;
  }
  return shuffled.slice(0, 3);
}

export function HabitForm({ initial, submitLabel, onSubmit }: { initial?: HabitInput; submitLabel: string; onSubmit: (input: HabitInput) => Promise<void> }) {
  const palette = usePalette();
  const [starters] = useState(pickStarterIdeas);
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [iconSeed] = useState(Math.random);
  const icon = initial && name.trim() === initial.name.trim() ? initial.icon : pickHabitIcon(name, () => iconSeed);
  const [color, setColor] = useState(initial?.color ?? HABIT_COLORS[0]);
  const [startDate, setStartDate] = useState(initial?.created_date ?? localDate(new Date()));
  const [reminderTime, setReminderTime] = useState<string | null>(initial?.reminder_enabled ? initial.reminder_time ?? null : null);
  const [reminderInterval, setReminderInterval] = useState<number | null>(initial?.reminder_interval_minutes ?? null);
  const [reminderEndTime, setReminderEndTime] = useState<string | null>(initial?.reminder_end_time ?? null);
  const [iosPicker, setIosPicker] = useState<'date' | 'time' | 'end_time' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  function pickerDate(mode: 'date' | 'time' | 'end_time'): Date {
    if (mode === 'date') return new Date(`${startDate}T12:00:00`);
    const date = new Date();
    const [hours, minutes] = (mode === 'end_time' ? reminderEndTime ?? '21:00' : reminderTime ?? '09:00').split(':').map(Number);
    date.setHours(hours ?? 9, minutes ?? 0, 0, 0);
    return date;
  }
  function select(mode: 'date' | 'time' | 'end_time', date: Date) {
    if (mode === 'date') setStartDate(localDate(date));
    else if (mode === 'end_time') setReminderEndTime(`${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`);
    else chooseReminderTime(`${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`);
  }
  function chooseReminderTime(time: string) {
    setReminderTime(time);
    if (reminderInterval && (!reminderEndTime || reminderEndTime <= time)) setReminderEndTime(time < '21:00' ? '21:00' : '23:59');
  }
  function chooseInterval(minutes: number | null) {
    setReminderInterval(minutes);
    if (!minutes) setReminderEndTime(null);
    else if (!reminderEndTime || reminderEndTime <= reminderTime!) setReminderEndTime((reminderTime ?? '09:00') < '21:00' ? '21:00' : '23:59');
  }
  function openPicker(mode: 'date' | 'time' | 'end_time') {
    Keyboard.dismiss();
    if (Platform.OS === 'android') DateTimePickerAndroid.open({ value: pickerDate(mode), mode: mode === 'date' ? 'date' : 'time', onValueChange: (_event, date) => select(mode, date) });
    else setIosPicker(mode);
  }
  const formattedDate = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${startDate}T12:00:00`));
  const formattedTime = reminderTime ? new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(pickerDate('time')) : 'Choose time';
  const formattedEndTime = reminderEndTime ? new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(pickerDate('end_time')) : 'Choose end time';
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowDate = localDate(tomorrow);
  async function submit() {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      if (reminderTime && !(await ensureReminderPermission())) throw new Error('Allow notifications to use reminders, or clear the reminder time.');
      await onSubmit({ name, description, icon, color, created_date: startDate, reminder_enabled: reminderTime ? 1 : 0, reminder_time: reminderTime, reminder_interval_minutes: reminderInterval, reminder_end_time: reminderEndTime });
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save habit.'); }
    finally { setBusy(false); }
  }
  return <View>
    {!initial && <><Text style={[styles.label, { color: palette.ink }]}>START WITH AN IDEA</Text><View style={styles.row}>{starters.map((starter) => <Pressable key={starter.label} accessibilityRole="button" accessibilityLabel={`Use ${starter.label} habit idea`} onPress={() => { setName(starter.name); setColor(starter.color); Keyboard.dismiss(); }} style={[styles.chip, { backgroundColor: palette.surface, borderColor: palette.line }]}><Text style={[styles.chipText, { color: palette.ink }]}>{starter.label}</Text></Pressable>)}</View></>}
    <Text style={[styles.label, { color: palette.ink }]}>NAME</Text>
    <View style={[styles.nameRow, { backgroundColor: palette.surface, borderColor: palette.line }]}><View style={[styles.nameIcon, { backgroundColor: `${color}24` }]}><Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={23} color={color} /></View><TextInput accessibilityLabel="Habit name" style={[styles.nameInput, { color: palette.ink }]} value={name} onChangeText={setName} placeholder="What will you do each day?" placeholderTextColor={palette.muted} maxLength={80} returnKeyType="done" onSubmitEditing={Keyboard.dismiss} /></View>
    <HabitGuidance name={name} />
    <Text style={[styles.label, { color: palette.ink }]}>A LITTLE CONTEXT <Text style={{ color: palette.muted }}>OPTIONAL</Text></Text>
    <TextInput style={[styles.input, styles.multiline, { backgroundColor: palette.surface, borderColor: palette.line, color: palette.ink }]} value={description ?? ''} onChangeText={setDescription} placeholder="What does this habit mean to you?" placeholderTextColor={palette.muted} maxLength={300} multiline />
    <Text style={[styles.label, { color: palette.ink }]}>START DATE</Text>
    <View style={styles.row}><Pressable accessibilityRole="button" accessibilityState={{ selected: startDate === localDate(new Date()) }} onPress={() => setStartDate(localDate(new Date()))} style={[styles.chip, { backgroundColor: startDate === localDate(new Date()) ? palette.purpleSoft : palette.surface, borderColor: startDate === localDate(new Date()) ? palette.purple : palette.line }]}><Text style={[styles.chipText, { color: palette.ink }]}>Today</Text></Pressable><Pressable accessibilityRole="button" accessibilityState={{ selected: startDate === tomorrowDate }} onPress={() => setStartDate(tomorrowDate)} style={[styles.chip, { backgroundColor: startDate === tomorrowDate ? palette.purpleSoft : palette.surface, borderColor: startDate === tomorrowDate ? palette.purple : palette.line }]}><Text style={[styles.chipText, { color: palette.ink }]}>Tomorrow</Text></Pressable></View>
    <Pressable accessibilityRole="button" accessibilityLabel={`Start date ${formattedDate}. Open calendar`} onPress={() => openPicker('date')} style={[styles.pickerButton, { backgroundColor: palette.surface, borderColor: palette.line }]}><Ionicons name="calendar-outline" size={21} color={palette.purple} /><Text style={[styles.pickerText, { color: palette.ink }]}>{formattedDate}</Text><Ionicons name="chevron-down" size={18} color={palette.muted} /></Pressable>
    <Text style={[styles.label, { color: palette.ink }]}>REMINDERS <Text style={{ color: palette.muted }}>OPTIONAL</Text></Text>
    <Text style={[styles.helper, { color: palette.muted }]}>A gentle nudge once, or throughout your day.</Text>
    <View style={styles.row}>{[{ label: 'Morning', time: '09:00' }, { label: 'Afternoon', time: '14:00' }, { label: 'Evening', time: '19:00' }].map((option) => <Pressable key={option.time} accessibilityRole="button" accessibilityState={{ selected: reminderTime === option.time }} onPress={() => chooseReminderTime(option.time)} style={[styles.chip, { backgroundColor: reminderTime === option.time ? palette.purpleSoft : palette.surface, borderColor: reminderTime === option.time ? palette.purple : palette.line }]}><Text style={[styles.chipText, { color: palette.ink }]}>{option.label}</Text></Pressable>)}</View>
    <View style={styles.pickerRow}><Pressable accessibilityRole="button" accessibilityLabel={`First reminder ${formattedTime}. Open time picker`} onPress={() => openPicker('time')} style={[styles.pickerButton, styles.timeButton, { backgroundColor: palette.surface, borderColor: palette.line }]}><Ionicons name="time-outline" size={21} color={palette.purple} /><Text style={[styles.pickerText, { color: palette.ink }]}>{formattedTime}</Text><Ionicons name="chevron-down" size={18} color={palette.muted} /></Pressable>{reminderTime && <Pressable accessibilityRole="button" accessibilityLabel="Remove reminder time" onPress={() => { setReminderTime(null); setReminderInterval(null); setReminderEndTime(null); }} style={styles.clearButton}><Text style={{ color: palette.purple, fontFamily: type.bold }}>Clear</Text></Pressable>}</View>
    {reminderTime && <><Text style={[styles.label, { color: palette.ink }]}>REPEAT</Text>
      <View style={styles.row}>{[{ label: 'Once', minutes: null }, { label: 'Every 1h', minutes: 60 }, { label: 'Every 2h', minutes: 120 }, { label: 'Every 3h', minutes: 180 }, { label: 'Every 4h', minutes: 240 }].map((option) => <Pressable key={option.label} accessibilityRole="button" accessibilityState={{ selected: reminderInterval === option.minutes }} onPress={() => chooseInterval(option.minutes)} style={[styles.chip, { backgroundColor: reminderInterval === option.minutes ? palette.purpleSoft : palette.surface, borderColor: reminderInterval === option.minutes ? palette.purple : palette.line }]}><Text style={[styles.chipText, { color: palette.ink }]}>{option.label}</Text></Pressable>)}</View>
      {reminderInterval && <><Pressable accessibilityRole="button" accessibilityLabel={`Last reminder ${formattedEndTime}. Open time picker`} onPress={() => openPicker('end_time')} style={[styles.pickerButton, { backgroundColor: palette.surface, borderColor: palette.line }]}><Ionicons name="moon-outline" size={21} color={palette.purple} /><Text style={[styles.pickerText, { color: palette.ink }]}>Until {formattedEndTime}</Text><Ionicons name="chevron-down" size={18} color={palette.muted} /></Pressable>
        {reminderEndTime && reminderEndTime > reminderTime && <Text style={[styles.helper, styles.scheduleHint, { color: palette.muted }]}>{reminderTimes(reminderTime, reminderEndTime, reminderInterval).length} reminders each day, from {formattedTime}.</Text>}</>}
    </>}
    {iosPicker && <View style={[styles.iosPicker, { backgroundColor: palette.surface }]}><DateTimePicker value={pickerDate(iosPicker)} mode={iosPicker === 'date' ? 'date' : 'time'} display="spinner" onValueChange={(_event, date) => select(iosPicker, date)} /><Pressable accessibilityRole="button" accessibilityLabel="Done selecting" onPress={() => setIosPicker(null)} style={styles.doneButton}><Text style={{ color: palette.purple, fontFamily: type.bold }}>Done</Text></Pressable></View>}
    <Text style={[styles.label, { color: palette.ink }]}>COLOR</Text>
    <View style={styles.row}>{HABIT_COLORS.map((item) => <Pressable key={item} accessibilityRole="button" accessibilityLabel={`Color ${item}`} accessibilityState={{ selected: color === item }} onPress={() => setColor(item)} style={[styles.swatch, { backgroundColor: item }, color === item && { borderColor: palette.ink, borderWidth: 3 }]}>{color === item && <Ionicons name="checkmark" color="white" size={19} />}</Pressable>)}</View>
    {error && <Text style={[styles.error, { color: palette.danger }]}>{error}</Text>}
    <View style={{ marginTop: 28 }}><ActionButton label={busy ? 'Saving…' : submitLabel} onPress={() => void submit()} disabled={busy} /></View>
  </View>;
}

const styles = StyleSheet.create({ label: { fontSize: 11, letterSpacing: 1.3, fontFamily: type.bold, marginTop: 29, marginBottom: 11 }, helper: { fontFamily: type.body, fontSize: 13, lineHeight: 19, marginBottom: 12 }, scheduleHint: { marginTop: 10, marginBottom: 0 }, nameRow: { borderWidth: 1, borderRadius: 14, minHeight: 56, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }, nameIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' }, nameInput: { flex: 1, minHeight: 54, fontFamily: type.body, fontSize: 15 }, input: { borderWidth: 1, borderRadius: 14, padding: 15, minHeight: 52, fontFamily: type.body, fontSize: 15 }, multiline: { minHeight: 90, textAlignVertical: 'top' }, pickerButton: { borderWidth: 1, borderRadius: 14, minHeight: 54, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 }, pickerText: { flex: 1, fontFamily: type.medium, fontSize: 15 }, pickerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 }, timeButton: { flex: 1 }, clearButton: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 4 }, iosPicker: { borderRadius: 16, marginTop: 12, padding: 8 }, doneButton: { alignSelf: 'flex-end', padding: 12 }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, chip: { minHeight: 42, borderWidth: 1, borderRadius: 13, paddingHorizontal: 14, justifyContent: 'center' }, chipText: { fontFamily: type.body, fontSize: 13 }, swatch: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }, error: { marginTop: 18, fontFamily: type.medium } });
