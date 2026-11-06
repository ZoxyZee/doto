import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { localDate } from '@/domain/habitRules';
import type { Habit } from '@/types/habit';

const channelId = 'habit-reminders';
const notificationId = (id: string) => `habit-${id}`;

export async function cancelReminder(id: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(notificationId(id));
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

export async function ensureReminderPermission(): Promise<boolean> {
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync(channelId, { name: 'Habit reminders', importance: Notifications.AndroidImportance.DEFAULT });
  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted && permission.canAskAgain) permission = await Notifications.requestPermissionsAsync();
  return permission.granted;
}

export async function syncReminder(habit: Habit): Promise<void> {
  await cancelReminder(habit.id);
  if (!habit.reminder_enabled || !habit.reminder_time || habit.deleted_at || habit.archived_at) return;
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) return;
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync(channelId, { name: 'Habit reminders', importance: Notifications.AndroidImportance.DEFAULT });
  const [hour, minute] = habit.reminder_time.split(':').map(Number);
  const today = localDate(new Date());
  const trigger = habit.created_date > today
    ? { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(`${habit.created_date}T${habit.reminder_time}:00`), channelId }
    : { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: hour!, minute: minute!, channelId };
  await Notifications.scheduleNotificationAsync({ identifier: notificationId(habit.id), content: { title: 'A little every day.', body: `Time for ${habit.name}.`, data: { habitId: habit.id } }, trigger });
}
