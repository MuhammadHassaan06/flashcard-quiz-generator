"use client";

import { motion } from "framer-motion";

export interface Badge {
  id: string;
  icon: string;
  title: string;
  description: string;
  unlocked: boolean;
  progressText: string;
}

export default function AchievementBadges({
  totalDecks,
  masteredCards,
  currentStreak,
}: {
  totalDecks: number;
  masteredCards: number;
  currentStreak: number;
}) {
  const badges: Badge[] = [
    {
      id: "deck-builder",
      icon: "📚",
      title: "Deck Architect",
      description: "Create your first study deck",
      unlocked: totalDecks >= 1,
      progressText: totalDecks >= 1 ? "Unlocked" : `${totalDecks}/1 Decks`,
    },
    {
      id: "streak-warrior",
      icon: "🔥",
      title: "Streak Warrior",
      description: "Maintain a 3-day active study streak",
      unlocked: currentStreak >= 3,
      progressText: currentStreak >= 3 ? "Unlocked" : `${currentStreak}/3 Days`,
    },
    {
      id: "mastery-scholar",
      icon: "🧠",
      title: "Mastery Scholar",
      description: "Master 10+ flashcards (Interval ≥ 7 days)",
      unlocked: masteredCards >= 10,
      progressText: masteredCards >= 10 ? "Unlocked" : `${masteredCards}/10 Cards`,
    },
    {
      id: "pomodoro-champ",
      icon: "⏱️",
      title: "Focus Master",
      description: "Complete a Pomodoro study sprint",
      unlocked: true, // Unlocked for all active learners
      progressText: "Unlocked",
    },
    {
      id: "voice-pro",
      icon: "🎤",
      title: "Speech Master",
      description: "Use speech-to-text voice mode",
      unlocked: true,
      progressText: "Unlocked",
    },
  ];

  return (
    <div className="bg-white dark:bg-white/5 border border-ink/10 dark:border-paper/10 rounded-3xl p-6 shadow-sm mb-8 text-left">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="font-display text-lg font-bold">Milestone Achievement Badges</h3>
          <p className="text-xs text-muted">Unlock rewards as you build your daily study habit</p>
        </div>
        <span className="text-xs font-bold text-accent bg-accent/15 px-3 py-1 rounded-full">
          {badges.filter((b) => b.unlocked).length}/{badges.length} Unlocked
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {badges.map((b) => (
          <motion.div
            key={b.id}
            whileHover={{ y: -2 }}
            className={`p-4 rounded-2xl border transition-all flex items-center gap-3.5 ${
              b.unlocked
                ? "bg-accent/5 border-accent/20 shadow-sm"
                : "bg-ink/5 dark:bg-paper/5 border-ink/5 dark:border-paper/5 opacity-50 grayscale"
            }`}
          >
            <div className="h-12 w-12 rounded-2xl bg-white dark:bg-ink border border-ink/10 dark:border-paper/10 flex items-center justify-center text-2xl shrink-0 shadow-sm">
              {b.icon}
            </div>
            <div>
              <h4 className="text-xs font-bold text-ink dark:text-paper flex items-center gap-1.5">
                {b.title}
                {b.unlocked && <span className="text-[10px] text-emerald-500 font-extrabold">✓</span>}
              </h4>
              <p className="text-[11px] text-muted leading-tight mt-0.5">{b.description}</p>
              <span className="inline-block mt-1.5 text-[9px] font-bold text-accent">
                {b.progressText}
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
