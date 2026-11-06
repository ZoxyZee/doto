import { create } from 'zustand';
import type { SQLiteDatabase } from 'expo-sqlite';
import { notifyLocalChange } from '@/cloud/syncEvents';
import { createHabit, deleteHabit, getHabit, listHabits, setHabitArchived, updateHabit } from '@/database/habitRepository';
import { getTodayProgress, setTodayCompleted, type TodayProgress } from '@/database/completionRepository';
import { cancelReminder, syncReminder } from '@/notifications/reminders';
import type { Habit, HabitInput } from '@/types/habit';

type State = {
  habits: Habit[];
  archived: Habit[];
  loading: boolean;
  error: string | null;
  today: TodayProgress;
  refresh: (db: SQLiteDatabase) => Promise<void>;
  create: (db: SQLiteDatabase, input: HabitInput) => Promise<Habit>;
  update: (db: SQLiteDatabase, id: string, input: HabitInput) => Promise<void>;
  archive: (db: SQLiteDatabase, id: string, archived: boolean) => Promise<void>;
  remove: (db: SQLiteDatabase, id: string) => Promise<void>;
  find: (db: SQLiteDatabase, id: string) => Promise<Habit | null>;
  complete: (db: SQLiteDatabase, id: string, completed: boolean) => Promise<void>;
};

function message(error: unknown): string { return error instanceof Error ? error.message : 'Something went wrong.'; }

export const useHabitStore = create<State>((set, get) => ({
  habits: [], archived: [], loading: true, error: null,
  today: { date: '', completedIds: [], requiredCount: 0, completedCount: 0 },
  refresh: async (db) => {
    try {
      const [habits, archived, today] = await Promise.all([listHabits(db), listHabits(db, true), getTodayProgress(db)]);
      set({ habits, archived, today, loading: false, error: null });
      void Promise.allSettled([...habits, ...archived].map(syncReminder));
    } catch (error) { set({ loading: false, error: message(error) }); }
  },
  create: async (db, input) => { const habit = await createHabit(db, input); await syncReminder(habit).catch(() => undefined); await get().refresh(db); notifyLocalChange(); return habit; },
  update: async (db, id, input) => { const habit = await updateHabit(db, id, input); await syncReminder(habit).catch(() => undefined); await get().refresh(db); notifyLocalChange(); },
  archive: async (db, id, archived) => { const habit = await setHabitArchived(db, id, archived); await syncReminder(habit).catch(() => undefined); await get().refresh(db); notifyLocalChange(); },
  remove: async (db, id) => { await deleteHabit(db, id); await cancelReminder(id).catch(() => undefined); await get().refresh(db); notifyLocalChange(); },
  complete: async (db, id, completed) => { await setTodayCompleted(db, id, completed); await get().refresh(db); notifyLocalChange(); },
  find: getHabit,
}));
