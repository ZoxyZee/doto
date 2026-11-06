import type { HabitInput } from '@/types/habit';

export const HABIT_COLORS = ['#E98651', '#668D82', '#8091B5', '#B49462', '#A0809C'] as const;
export const HABIT_ICONS = ['sparkles', 'book-outline', 'fitness-outline', 'code-slash', 'leaf-outline', 'water-outline'] as const;

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
  return { name, description, icon: input.icon, color: input.color, created_date, reminder_enabled, reminder_time };
}

export function localDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
