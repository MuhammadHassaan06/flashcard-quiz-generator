"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabaseClient";
import type { Session } from "@supabase/supabase-js";

interface StudySession {
  date: string;
  cards_reviewed: number;
}

interface QuizAttempt {
  id: string;
  score: number;
  total: number;
  attempted_at: string;
  decks: { title: string } | null;
}

interface MasteryCounts {
  new: number;
  learning: number;
  mastered: number;
  total: number;
}

export default function AnalyticsPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [loading, setLoading] = useState(true);

  const [streak, setStreak] = useState(0);
  const [totalReviewed, setTotalReviewed] = useState(0);
  const [mastery, setMastery] = useState<MasteryCounts>({ new: 0, learning: 0, mastered: 0, total: 0 });
  const [quizAttempts, setQuizAttempts] = useState<QuizAttempt[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setCheckingAuth(false);
      if (!data.session) router.push("/");
    });
  }, [router]);

  useEffect(() => {
    if (!session) return;
    const userId = session.user.id;

    async function loadStats() {
      setLoading(true);

      // 1. Fetch study sessions
      const { data: sessionsData } = await supabase
        .from("study_sessions")
        .select("date, cards_reviewed")
        .eq("user_id", userId)
        .order("date", { ascending: false });

      const sessions = (sessionsData as StudySession[]) ?? [];
      const totalRev = sessions.reduce((sum, s) => sum + s.cards_reviewed, 0);
      setTotalReviewed(totalRev);
      setStreak(calculateStreak(sessions));

      // 2. Fetch cards for mastery analysis
      const { data: deckRows } = await supabase
        .from("decks")
        .select("id")
        .eq("user_id", userId);
      
      const deckIds = (deckRows ?? []).map((d) => d.id);
      if (deckIds.length > 0) {
        const { data: cardRows } = await supabase
          .from("cards")
          .select("repetitions, interval")
          .in("deck_id", deckIds);

        const cards = cardRows ?? [];
        const counts = { new: 0, learning: 0, mastered: 0, total: cards.length };
        cards.forEach((c) => {
          if (c.repetitions === 0) {
            counts.new++;
          } else if (c.interval >= 7) {
            counts.mastered++;
          } else {
            counts.learning++;
          }
        });
        setMastery(counts);
      }

      // 3. Fetch quiz attempts
      const { data: attemptsData } = await supabase
        .from("quiz_attempts")
        .select(`
          id,
          score,
          total,
          attempted_at,
          decks ( title )
        `)
        .eq("user_id", userId)
        .order("attempted_at", { ascending: true });

      setQuizAttempts((attemptsData as any[]) ?? []);
      setLoading(false);
    }

    loadStats();
  }, [session]);

  function calculateStreak(sessions: StudySession[]): number {
    if (!sessions || sessions.length === 0) return 0;

    const dates = sessions.map((s) => s.date).sort((a, b) => b.localeCompare(a));
    const todayStr = new Date().toLocaleDateString("en-CA");
    const yesterdayStr = new Date(Date.now() - 86400000).toLocaleDateString("en-CA");

    const latest = dates[0];
    if (latest !== todayStr && latest !== yesterdayStr) {
      return 0;
    }

    let streakCount = 0;
    let currentDate = latest === todayStr ? new Date() : new Date(Date.now() - 86400000);

    for (let i = 0; i < dates.length; i++) {
      const expectedStr = currentDate.toLocaleDateString("en-CA");
      if (dates.includes(expectedStr)) {
        streakCount++;
        currentDate.setDate(currentDate.getDate() - 1);
      } else {
        break;
      }
    }

    return streakCount;
  }

  if (checkingAuth || loading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="h-6 w-6 rounded-full border-2 border-accent border-t-transparent animate-spin" />
      </div>
    );
  }

  // Calculate percentages for mastery donut rings
  const pctMastered = mastery.total ? Math.round((mastery.mastered / mastery.total) * 100) : 0;
  const pctLearning = mastery.total ? Math.round((mastery.learning / mastery.total) * 100) : 0;
  const pctNew = mastery.total ? Math.round((mastery.new / mastery.total) * 100) : 0;

  // Circular progress stroke helper: circumference = 2 * pi * r
  const getStrokeDashOffset = (r: number, percentage: number) => {
    const circumference = 2 * Math.PI * r;
    return circumference - (percentage / 100) * circumference;
  };

  // SVG Line chart calculations
  const chartWidth = 500;
  const chartHeight = 180;
  const padding = 25;

  const points = quizAttempts.slice(-10).map((attempt, index) => {
    const x = padding + (index / Math.max(1, quizAttempts.slice(-10).length - 1)) * (chartWidth - padding * 2);
    const scorePct = attempt.total > 0 ? attempt.score / attempt.total : 0;
    const y = chartHeight - padding - scorePct * (chartHeight - padding * 2);
    return { x, y, scorePct: Math.round(scorePct * 100), ...attempt };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaPath = points.length > 0 
    ? `${linePath} L ${points[points.length - 1].x} ${chartHeight - padding} L ${points[0].x} ${chartHeight - padding} Z` 
    : "";

  return (
    <main className="max-w-4xl mx-auto px-6 py-12">
      {/* Title */}
      <div className="mb-10">
        <h1 className="font-display text-4xl font-extrabold tracking-tight bg-gradient-to-r from-ink to-ink/75 dark:from-paper dark:to-paper/75 bg-clip-text text-transparent">
          Learning Statistics
        </h1>
        <p className="text-xs text-muted mt-1 leading-relaxed">
          Monitor your daily study streaks, card retention rates, and historical quiz scores.
        </p>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-white/5 border border-ink/10 dark:border-paper/10 rounded-3xl p-6 shadow-sm flex items-center gap-4 relative overflow-hidden"
        >
          <div className="h-12 w-12 rounded-2xl bg-accent2/15 text-accent2 flex items-center justify-center text-2xl">
            🔥
          </div>
          <div>
            <span className="text-[10px] text-muted font-bold uppercase tracking-wider block">Daily Streak</span>
            <span className="text-2xl font-display font-extrabold text-ink dark:text-paper">{streak} Days</span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-white/5 border border-ink/10 dark:border-paper/10 rounded-3xl p-6 shadow-sm flex items-center gap-4 relative overflow-hidden"
        >
          <div className="h-12 w-12 rounded-2xl bg-accent/15 text-accent flex items-center justify-center text-2xl">
            📚
          </div>
          <div>
            <span className="text-[10px] text-muted font-bold uppercase tracking-wider block">Cards Reviewed</span>
            <span className="text-2xl font-display font-extrabold text-ink dark:text-paper">{totalReviewed} Cards</span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-white/5 border border-ink/10 dark:border-paper/10 rounded-3xl p-6 shadow-sm flex items-center gap-4 relative overflow-hidden"
        >
          <div className="h-12 w-12 rounded-2xl bg-amber-500/15 text-amber-500 flex items-center justify-center text-2xl">
            🏆
          </div>
          <div>
            <span className="text-[10px] text-muted font-bold uppercase tracking-wider block">Quizzes Taken</span>
            <span className="text-2xl font-display font-extrabold text-ink dark:text-paper">{quizAttempts.length} times</span>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
        {/* Card Mastery Rings */}
        <div className="bg-white dark:bg-white/5 border border-ink/10 dark:border-paper/10 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="font-display text-lg font-bold mb-1">Card Retention & Mastery</h2>
            <p className="text-[10px] text-muted mb-6">Breakdown of memory stages for generated flashcards.</p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-around gap-6">
            {/* Apple Activity Rings Styled pure SVG */}
            <div className="relative h-40 w-40 flex items-center justify-center">
              <svg className="h-full w-full -rotate-90">
                {/* Mastered Ring (Outer) */}
                <circle cx="80" cy="80" r="60" fill="transparent" stroke="currentColor" className="text-ink/5 dark:text-paper/5" strokeWidth="8" />
                <circle
                  cx="80"
                  cy="80"
                  r="60"
                  fill="transparent"
                  stroke="currentColor"
                  className="text-accent"
                  strokeWidth="8"
                  strokeDasharray={2 * Math.PI * 60}
                  strokeDashoffset={getStrokeDashOffset(60, pctMastered)}
                  strokeLinecap="round"
                />

                {/* Learning Ring (Middle) */}
                <circle cx="80" cy="80" r="46" fill="transparent" stroke="currentColor" className="text-ink/5 dark:text-paper/5" strokeWidth="8" />
                <circle
                  cx="80"
                  cy="80"
                  r="46"
                  fill="transparent"
                  stroke="currentColor"
                  className="text-blue-500"
                  strokeWidth="8"
                  strokeDasharray={2 * Math.PI * 46}
                  strokeDashoffset={getStrokeDashOffset(46, pctLearning)}
                  strokeLinecap="round"
                />

                {/* New Ring (Inner) */}
                <circle cx="80" cy="80" r="32" fill="transparent" stroke="currentColor" className="text-ink/5 dark:text-paper/5" strokeWidth="8" />
                <circle
                  cx="80"
                  cy="80"
                  r="32"
                  fill="transparent"
                  stroke="currentColor"
                  className="text-amber-500"
                  strokeWidth="8"
                  strokeDasharray={2 * Math.PI * 32}
                  strokeDashoffset={getStrokeDashOffset(32, pctNew)}
                  strokeLinecap="round"
                />
              </svg>
              {/* Inner Label */}
              <div className="absolute text-center">
                <span className="text-[10px] text-muted font-bold block uppercase tracking-wider">Total</span>
                <span className="text-xl font-display font-extrabold text-ink dark:text-paper">{mastery.total}</span>
              </div>
            </div>

            {/* Legends */}
            <div className="space-y-3.5">
              <div className="flex items-center gap-3">
                <span className="h-3.5 w-3.5 rounded-full bg-accent flex-shrink-0" />
                <div>
                  <span className="text-[10px] font-bold text-ink dark:text-paper block leading-none">Mastered ({pctMastered}%)</span>
                  <span className="text-[9px] text-muted font-semibold">{mastery.mastered} cards (Interval &ge; 7d)</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="h-3.5 w-3.5 rounded-full bg-blue-500 flex-shrink-0" />
                <div>
                  <span className="text-[10px] font-bold text-ink dark:text-paper block leading-none">Reviewing ({pctLearning}%)</span>
                  <span className="text-[9px] text-muted font-semibold">{mastery.learning} cards (In review stages)</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="h-3.5 w-3.5 rounded-full bg-amber-500 flex-shrink-0" />
                <div>
                  <span className="text-[10px] font-bold text-ink dark:text-paper block leading-none">New ({pctNew}%)</span>
                  <span className="text-[9px] text-muted font-semibold">{mastery.new} cards (Unreviewed)</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quiz Scores Trend Chart */}
        <div className="bg-white dark:bg-white/5 border border-ink/10 dark:border-paper/10 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="font-display text-lg font-bold mb-1">Quiz Score Trends</h2>
            <p className="text-[10px] text-muted mb-4">Latest 10 quiz score percentages.</p>
          </div>

          {quizAttempts.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-6 text-center">
              <span className="text-xl mb-1">📈</span>
              <p className="text-[10px] text-muted font-semibold">No quiz scores recorded yet.</p>
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
              <div style={{ width: chartWidth, height: chartHeight }} className="mx-auto relative">
                <svg width={chartWidth} height={chartHeight} className="overflow-visible">
                  <defs>
                    <linearGradient id="area-grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal Grid Lines */}
                  {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                    const y = padding + ratio * (chartHeight - padding * 2);
                    return (
                      <line
                        key={ratio}
                        x1={padding}
                        y1={y}
                        x2={chartWidth - padding}
                        y2={y}
                        stroke="currentColor"
                        className="text-ink/5 dark:text-paper/5"
                        strokeWidth="1.5"
                        strokeDasharray="4"
                      />
                    );
                  })}

                  {/* Area fill */}
                  {areaPath && <path d={areaPath} fill="url(#area-grad)" />}

                  {/* Trend line */}
                  {linePath && (
                    <path
                      d={linePath}
                      fill="none"
                      stroke="var(--accent)"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                    />
                  )}

                  {/* Points (circles) */}
                  {points.map((p, idx) => (
                    <g key={p.id}>
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r="5"
                        fill="var(--accent)"
                        stroke="white"
                        strokeWidth="2"
                        className="shadow-sm"
                      />
                      {/* Text score preview overlay */}
                      <text
                        x={p.x}
                        y={p.y - 10}
                        textAnchor="middle"
                        fill="currentColor"
                        className="text-[9px] font-extrabold text-ink dark:text-paper"
                      >
                        {p.scorePct}%
                      </text>
                    </g>
                  ))}
                </svg>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Attempts log */}
      {quizAttempts.length > 0 && (
        <div className="bg-white dark:bg-white/5 border border-ink/10 dark:border-paper/10 rounded-3xl p-6 shadow-sm">
          <h2 className="font-display text-lg font-bold mb-4 border-b border-ink/5 dark:border-paper/5 pb-3">Quiz Attempt History</h2>
          <div className="max-h-[300px] overflow-y-auto pr-2 space-y-3">
            {quizAttempts.slice().reverse().map((att) => (
              <div
                key={att.id}
                className="flex items-center justify-between p-3.5 bg-paper/20 dark:bg-ink/30 border border-ink/5 dark:border-paper/5 rounded-2xl"
              >
                <div>
                  <h4 className="text-xs font-bold text-ink dark:text-paper">{att.decks?.title || "Deleted Deck"}</h4>
                  <span className="text-[9px] text-muted">
                    {new Date(att.attempted_at).toLocaleDateString()} at {new Date(att.attempted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-extrabold text-accent">{att.score} / {att.total}</span>
                  <p className="text-[9px] text-muted font-bold">{Math.round((att.score / att.total) * 100)}% correct</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
