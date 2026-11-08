export function reminderTimes(start: string, end: string | null, intervalMinutes: number | null): string[] {
  const validTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  if (!validTime(start)) return [];
  if (!intervalMinutes || !end) return [start];
  if (![60, 120, 180, 240].includes(intervalMinutes) || !validTime(end) || end <= start) return [start];
  const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
  const slots: string[] = [];
  for (let minute = minutes(start); minute <= minutes(end) && slots.length < 24; minute += intervalMinutes) {
    slots.push(`${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`);
  }
  return slots;
}
