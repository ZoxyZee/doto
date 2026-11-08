import type { HabitInput } from '@/types/habit';

export const HABIT_COLORS = ['#E98651', '#668D82', '#8091B5', '#B49462', '#A0809C'] as const;
export const HABIT_ICONS = [
  'sparkles', 'checkmark-circle-outline', 'calendar-outline', 'book-outline', 'reader-outline',
  'library-outline', 'fitness-outline', 'walk-outline', 'barbell-outline', 'code-slash',
  'terminal-outline', 'laptop-outline', 'leaf-outline', 'flower-outline', 'water-outline',
  'pint-outline', 'moon-outline', 'bed-outline', 'create-outline',
] as const;

type HabitIcon = typeof HABIT_ICONS[number];
export type HabitCategory = 'water' | 'reading' | 'movement' | 'coding' | 'mindfulness' | 'sleep' | 'writing' | 'planning' | 'cleaning' | 'general';

const iconGroups: { category: Exclude<HabitCategory, 'general'>; words: RegExp; icons: readonly HabitIcon[] }[] = [
  { category: 'water', words: /\b(water|drink|hydrat|paani|pani)\w*|पानी/i, icons: ['water-outline', 'pint-outline'] },
  { category: 'reading', words: /\b(read|book|stud|learn|lesson|word|padh)\w*|पढ़/i, icons: ['book-outline', 'reader-outline', 'library-outline'] },
  { category: 'movement', words: /\b(walk|run|exercis|workout|gym|stretch|steps|fitness|yoga)\w*|व्यायाम|चलना/i, icons: ['walk-outline', 'fitness-outline', 'barbell-outline'] },
  { category: 'coding', words: /\b(code|coding|program|develop|software)\w*/i, icons: ['code-slash', 'terminal-outline', 'laptop-outline'] },
  { category: 'mindfulness', words: /\b(meditat|mindful|breath|nature|garden)\w*|ध्यान/i, icons: ['leaf-outline', 'flower-outline', 'sparkles'] },
  { category: 'sleep', words: /\b(sleep|bed|rest|nap|neend)\w*|नींद/i, icons: ['moon-outline', 'bed-outline'] },
  { category: 'writing', words: /\b(write|writing|journal|diary|notes)\w*/i, icons: ['create-outline', 'book-outline'] },
  { category: 'planning', words: /\b(plan|organiz|organis|schedule|tomorrow)\w*/i, icons: ['calendar-outline', 'create-outline', 'sparkles'] },
  { category: 'cleaning', words: /\b(tidy|clean|declutter)\w*/i, icons: ['sparkles', 'checkmark-circle-outline'] },
];

export function habitCategory(name: string): HabitCategory {
  return iconGroups.find(({ words }) => words.test(name))?.category ?? 'general';
}

export function pickHabitIcon(name: string, random: () => number = Math.random): HabitIcon {
  const group = iconGroups.find(({ words }) => words.test(name));
  const options = group?.icons ?? ['sparkles', 'checkmark-circle-outline', 'leaf-outline'];
  const index = Math.min(options.length - 1, Math.max(0, Math.floor(random() * options.length)));
  return options[index] as HabitIcon;
}

export function validateHabit(input: HabitInput): Required<HabitInput> {
  const name = input.name.trim().replace(/\s+/g, ' ');
  const description = input.description?.trim() || null;
  if (!name || name.length > 80) throw new Error('Give this habit a name of 1–80 characters.');
  if (description && description.length > 300) throw new Error('Keep the description under 300 characters.');
  if (!HABIT_COLORS.includes(input.color as typeof HABIT_COLORS[number])) throw new Error('Choose a valid color.');
  if (!HABIT_ICONS.includes(input.icon as typeof HABIT_ICONS[number])) throw new Error('Choose a valid icon.');
  const created_date = input.created_date ?? localDate(new Date());
  const parsed = new Date(`${created_date}T12:00:00`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(created_date) || Number.isNaN(parsed.getTime()) || localDate(parsed) !== created_date) throw new Error('Choose a valid start date.');
  const reminder_enabled = input.reminder_enabled ? 1 : 0;
  const reminder_time = reminder_enabled ? input.reminder_time ?? null : null;
  if (reminder_enabled && (!reminder_time || !/^([01]\d|2[0-3]):[0-5]\d$/.test(reminder_time))) throw new Error('Choose a valid reminder time.');
  const reminder_interval_minutes = reminder_enabled ? input.reminder_interval_minutes ?? null : null;
  const reminder_end_time = reminder_interval_minutes ? input.reminder_end_time ?? null : null;
  if (reminder_interval_minutes !== null && ![60, 120, 180, 240].includes(reminder_interval_minutes)) throw new Error('Choose a valid reminder interval.');
  if (reminder_interval_minutes !== null && (!reminder_end_time || !/^([01]\d|2[0-3]):[0-5]\d$/.test(reminder_end_time) || reminder_end_time <= reminder_time!)) {
    throw new Error('Choose an end time after the first reminder.');
  }
  return { name, description, icon: input.icon, color: input.color, created_date, reminder_enabled, reminder_time, reminder_interval_minutes, reminder_end_time };
}

export function localDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
