import { habitCategory } from '@/domain/habitRules';

export type HabitGuidance = { tip: string; benefits: readonly [string, string] };

const guidance: Record<ReturnType<typeof habitCategory>, HabitGuidance> = {
  water: {
    tip: 'Keep a glass or bottle where you can see it. Take a few sips after a routine you already do.',
    benefits: ['An easy cue to remember', 'A steadier daily routine'],
  },
  reading: {
    tip: 'Leave your book within reach and begin with just one page at the same time each day.',
    benefits: ['More time to learn', 'A calm daily pause'],
  },
  movement: {
    tip: 'Start with a short, comfortable session. Put your shoes or mat out beforehand.',
    benefits: ['More daily movement', 'An easier starting point'],
  },
  coding: {
    tip: 'Pick one tiny problem to solve before you open your editor. Save what you learned afterward.',
    benefits: ['Focused practice', 'Visible progress'],
  },
  mindfulness: {
    tip: 'Choose a quiet moment and begin with two minutes of slow breathing or simply noticing your surroundings.',
    benefits: ['A pause in the day', 'More room to reflect'],
  },
  sleep: {
    tip: 'Aim for a consistent bedtime. Put screens away about 30 minutes before bed and start a calming routine.',
    benefits: ['May support focus', 'May make mornings easier'],
  },
  writing: {
    tip: 'Keep a notebook ready. Write one sentence first; you can always stop there.',
    benefits: ['A place for your thoughts', 'A simple way to notice progress'],
  },
  planning: {
    tip: 'Choose the next day’s one most important task and decide when you will start it.',
    benefits: ['A clearer next step', 'Less to decide later'],
  },
  cleaning: {
    tip: 'Pick one small area and set a five-minute timer. Stop when the timer ends.',
    benefits: ['A more manageable start', 'Visible small wins'],
  },
  general: {
    tip: 'Choose when and where you will do this, then begin with a two-minute version.',
    benefits: ['A clear next step', 'Easier to repeat'],
  },
};

export function getHabitGuidance(name: string): HabitGuidance | null {
  return name.trim().length >= 3 ? guidance[habitCategory(name)] : null;
}
