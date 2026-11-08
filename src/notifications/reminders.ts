import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { localDate } from '@/domain/habitRules';
import { reminderTimes } from '@/domain/reminderSchedule';
import type { Habit } from '@/types/habit';

const channelId = 'habit-reminders-v2';
const notificationId = (id: string) => `habit-${id}`;

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
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync(channelId, { name: 'Habit reminders', importance: Notifications.AndroidImportance.DEFAULT, sound: 'default' });
  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted && permission.canAskAgain) permission = await Notifications.requestPermissionsAsync();
  return permission.granted;
}

export async function syncReminder(habit: Habit): Promise<void> {
  await cancelReminder(habit.id);
  if (!habit.reminder_enabled || !habit.reminder_time || habit.deleted_at || habit.archived_at) return;
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) return;
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync(channelId, { name: 'Habit reminders', importance: Notifications.AndroidImportance.DEFAULT, sound: 'default' });
  const today = localDate(new Date());
  const times = reminderTimes(habit.reminder_time, habit.reminder_end_time, habit.reminder_interval_minutes);
  for (const [index, time] of times.entries()) {
    const [hour, minute] = time.split(':').map(Number);
    const trigger = habit.created_date > today
      ? { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(`${habit.created_date}T${time}:00`), channelId }
      : { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: hour!, minute: minute!, channelId };
    await Notifications.scheduleNotificationAsync({
      identifier: `${notificationId(habit.id)}-${index}`,
      content: { title: 'A little every day.', body: `Time for ${habit.name}.`, sound: 'default', data: { habitId: habit.id } },
      trigger,
    });
  }
}
