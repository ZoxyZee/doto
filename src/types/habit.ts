export type Habit = {
  id: string;
  owner_id: string | null;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  deleted_at: string | null;
  reminder_enabled: number;
  reminder_time: string | null;
  reminder_interval_minutes: number | null;
  reminder_end_time: string | null;
  version: number;
  local_revision: number;
  created_date: string;
  created_timezone: string;
};

export type HabitInput = Pick<Habit, 'name' | 'description' | 'icon' | 'color'> &
  Partial<Pick<Habit, 'created_date' | 'reminder_time' | 'reminder_enabled' | 'reminder_interval_minutes' | 'reminder_end_time'>>;
