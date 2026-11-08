import { beforeEach, expect, test, vi } from 'vitest';
import type { Habit } from '../src/types/habit';

const scheduled = vi.hoisted(() => [] as { identifier: string; trigger: Record<string, unknown>; content: Record<string, unknown> }[]);
const channel = vi.hoisted(() => vi.fn());

vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));
vi.mock('expo-notifications', () => ({
  AndroidImportance: { DEFAULT: 3 },
  SchedulableTriggerInputTypes: { DATE: 'date', DAILY: 'daily' },
  setNotificationHandler: vi.fn(),
  setNotificationChannelAsync: channel,
  getPermissionsAsync: async () => ({ granted: true, canAskAgain: false }),
  getAllScheduledNotificationsAsync: async () => scheduled.map(({ identifier }) => ({ identifier })),
  cancelScheduledNotificationAsync: async (identifier: string) => {
    const index = scheduled.findIndex((item) => item.identifier === identifier);
    if (index >= 0) scheduled.splice(index, 1);
  },
  scheduleNotificationAsync: async (request: typeof scheduled[number]) => {
    scheduled.push(request);
    return request.identifier;
  },
}));

const { syncReminder, cancelReminder } = await import('../src/notifications/reminders');

const base = {
  id: 'water', name: 'Drink water', created_date: '2020-01-01',
  reminder_enabled: 1, reminder_time: '08:30', reminder_interval_minutes: 120,
  reminder_end_time: '18:30', deleted_at: null, archived_at: null,
} as Habit;

beforeEach(() => { scheduled.length = 0; channel.mockClear(); });

test('schedules each interval as a daily local notification with sound', async () => {
  await syncReminder(base);
  expect(scheduled.map((item) => item.identifier)).toEqual([
    'habit-water-0', 'habit-water-1', 'habit-water-2',
    'habit-water-3', 'habit-water-4', 'habit-water-5',
  ]);
  expect(scheduled.map((item) => [item.trigger.hour, item.trigger.minute])).toEqual([
    [8, 30], [10, 30], [12, 30], [14, 30], [16, 30], [18, 30],
  ]);
  expect(scheduled.every((item) => item.trigger.type === 'daily' && item.content.sound === 'default')).toBe(true);
  expect(channel).toHaveBeenCalledWith('habit-reminders-v2', expect.objectContaining({ sound: 'default' }));
});

test('editing or archiving removes old slots and the legacy single reminder', async () => {
  scheduled.push({ identifier: 'habit-water', trigger: {}, content: {} });
  await syncReminder(base);
  expect(scheduled).toHaveLength(6);
  await syncReminder({ ...base, reminder_interval_minutes: null, reminder_end_time: null });
  expect(scheduled.map((item) => item.identifier)).toEqual(['habit-water-0']);
  await syncReminder({ ...base, archived_at: new Date().toISOString() });
  expect(scheduled).toHaveLength(0);
  await cancelReminder(base.id);
});

test('future start dates schedule first-day reminders without firing early', async () => {
  await syncReminder({ ...base, created_date: '2099-01-01' });
  expect(scheduled).toHaveLength(6);
  expect(scheduled.every((item) => item.trigger.type === 'date' && item.trigger.date instanceof Date)).toBe(true);
  expect((scheduled[0]?.trigger.date as Date).getFullYear()).toBe(2099);
});
