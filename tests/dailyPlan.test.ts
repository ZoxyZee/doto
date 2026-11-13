import { expect, test } from 'vitest';
import { dailyPlan } from '../src/domain/dailyPlan';
import type { Habit } from '../src/types/habit';

const item = (id: string, time: string | null, date = '2026-01-01') => ({
  id, name: id, reminder_enabled: time ? 1 : 0, reminder_time: time, created_date: date,
}) as Habit;

test('orders repeating daily moments and separates future and untimed habits', () => {
  const plan = dailyPlan([
    item('evening', '20:00'), item('untimed', null), item('morning', '08:00'),
    item('future', '07:00', '2099-01-01'),
  ], '2026-11-13');
  expect(plan.today.map(({ id }) => id)).toEqual(['morning', 'evening']);
  expect(plan.upcoming.map(({ id }) => id)).toEqual(['future']);
  expect(plan.untimed.map(({ id }) => id)).toEqual(['untimed']);
});
