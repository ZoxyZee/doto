import type { Habit } from '@/types/habit';

export function dailyPlan(habits: Habit[], date: string) {
  const timed = habits.filter((habit) => habit.reminder_enabled && habit.reminder_time)
    .sort((a, b) => a.reminder_time!.localeCompare(b.reminder_time!) || a.name.localeCompare(b.name));
  return {
    today: timed.filter((habit) => habit.created_date <= date),
    upcoming: timed.filter((habit) => habit.created_date > date),
    untimed: habits.filter((habit) => !habit.reminder_enabled || !habit.reminder_time),
  };
}
