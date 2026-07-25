// Standard SM-2 spaced repetition algorithm.
// quality: 0 = Wrong, 3 = Hard, 5 = Easy  (mapped from the UI buttons)

export interface SM2State {
  interval: number;       // days until next review
  ease_factor: number;    // starts at 2.5
  repetitions: number;    // consecutive correct reviews
  next_review_date: string; // ISO date string
}

export function calculateSM2(current: SM2State, quality: 0 | 3 | 5): SM2State {
  let { interval, ease_factor, repetitions } = current;

  if (quality < 3) {
    // Wrong answer: reset the streak, review again tomorrow.
    repetitions = 0;
    interval = 1;
  } else {
    repetitions += 1;
    if (repetitions === 1) {
      interval = 1;
    } else if (repetitions === 2) {
      interval = 6;
    } else {
      interval = Math.round(interval * ease_factor);
    }
  }

  // Ease factor update (never drops below 1.3).
  ease_factor = Math.max(
    1.3,
    ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  );

  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + interval);

  return {
    interval,
    ease_factor: Number(ease_factor.toFixed(2)),
    repetitions,
    next_review_date: nextDate.toISOString(),
  };
}

export function defaultSM2State(): SM2State {
  return {
    interval: 0,
    ease_factor: 2.5,
    repetitions: 0,
    next_review_date: new Date().toISOString(),
  };
}

// UI button -> SM-2 quality score
export const QUALITY = { WRONG: 0, HARD: 3, EASY: 5 } as const;
