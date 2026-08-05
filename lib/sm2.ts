// Standard SM-2 4-Button Spaced Repetition Algorithm.
// quality: 0 = Again, 2 = Hard, 3 = Good, 5 = Easy

export interface SM2State {
  interval: number;         // days until next review
  ease_factor: number;      // starts at 2.5
  repetitions: number;      // consecutive correct reviews
  next_review_date: string; // ISO date string
}

export type QualityGrade = 0 | 2 | 3 | 5;

export function calculateSM2(current: SM2State, quality: QualityGrade): SM2State {
  let { interval, ease_factor, repetitions } = current;

  if (quality === 0) {
    // AGAIN: Forgot card, reset streak, review again tomorrow.
    repetitions = 0;
    interval = 1;
    ease_factor = Math.max(1.3, ease_factor - 0.2);
  } else if (quality === 2) {
    // HARD: Remembered with significant effort, small interval growth.
    repetitions += 1;
    interval = Math.max(1, Math.round((interval || 1) * 1.2));
    ease_factor = Math.max(1.3, ease_factor - 0.15);
  } else if (quality === 3) {
    // GOOD: Perfect recall at expected interval.
    repetitions += 1;
    if (repetitions === 1) {
      interval = 1;
    } else if (repetitions === 2) {
      interval = 6;
    } else {
      interval = Math.round((interval || 1) * ease_factor);
    }
  } else if (quality === 5) {
    // EASY: Trivial recall, larger interval boost & ease factor bonus.
    repetitions += 1;
    if (repetitions === 1) {
      interval = 2;
    } else if (repetitions === 2) {
      interval = 7;
    } else {
      interval = Math.round((interval || 1) * ease_factor * 1.3);
    }
    ease_factor = Math.min(3.0, ease_factor + 0.15);
  }

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

// 4-Button Quality Mapping
export const QUALITY = {
  AGAIN: 0,
  HARD: 2,
  GOOD: 3,
  EASY: 5,
} as const;
