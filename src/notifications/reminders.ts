import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { habitCategory, localDate } from '@/domain/habitRules';
import { reminderTimes } from '@/domain/reminderSchedule';
import type { Habit } from '@/types/habit';

const channelId = 'habit-reminders-v3';
const notificationId = (id: string) => `habit-${id}`;
const accent = '#E98651';

const reminderLines = {
  water: ['A few sips. A small reset.', 'Pause for a little water break.'],
  reading: ['One page is a lovely place to start.', 'Make a little room for your next page.'],
  movement: ['A few minutes of movement count.', 'Take a gentle step into your day.'],
  coding: ['One small problem is enough to begin.', 'A little practice adds up.'],
  mindfulness: ['Take a breath and come back to this moment.', 'A quiet minute is yours.'],
  sleep: ['Ease into your evening routine.', 'Give yourself a little time to wind down.'],
  writing: ['One sentence is a good beginning.', 'Make a little space for your thoughts.'],
  planning: ['Choose one small next step.', 'A clear next step starts here.'],
  cleaning: ['Start with one small corner.', 'Five gentle minutes can make a difference.'],
  general: ['A small step today still counts.', 'Take a moment for what matters to you.'],
} as const;

function reminderBody(habit: Habit, slot: number): string {
  const lines = reminderLines[habitCategory(habit.name)];
  return lines[slot % lines.length] ?? lines[0];
}

async function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(channelId, {
    name: 'DOTO reminders',
    description: 'Gentle nudges for the habits you choose.',
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: 'default',
    lightColor: accent,
    showBadge: false,
  });
}

export async function cancelReminder(id: string): Promise<void> {
  const prefix = `${notificationId(id)}-`;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(scheduled
    .filter((item) => item.identifier === notificationId(id) || item.identifier.startsWith(prefix))
    .map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier)));
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

export async function ensureReminderPermission(): Promise<boolean> {
  await ensureChannel();
  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted && permission.canAskAgain) permission = await Notifications.requestPermissionsAsync();
  return permission.granted;
}

export async function syncReminder(habit: Habit): Promise<void> {
  await cancelReminder(habit.id);
  if (!habit.reminder_enabled || !habit.reminder_time || habit.deleted_at || habit.archived_at) return;
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) return;
  await ensureChannel();
  const today = localDate(new Date());
  const times = reminderTimes(habit.reminder_time, habit.reminder_end_time, habit.reminder_interval_minutes);
  for (const [index, time] of times.entries()) {
    const [hour, minute] = time.split(':').map(Number);
    const trigger = habit.created_date > today
      ? { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(`${habit.created_date}T${time}:00`), channelId }
      : { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: hour!, minute: minute!, channelId };
    await Notifications.scheduleNotificationAsync({
      identifier: `${notificationId(habit.id)}-${index}`,
      content: {
        title: habit.name,
        body: reminderBody(habit, index),
        sound: 'default',
        color: accent,
        threadIdentifier: `habit-${habit.id}`,
        data: { habitId: habit.id },
      },
      trigger,
    });
  }
}
