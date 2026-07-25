"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import FlipCard from "@/components/FlipCard";
import { supabase } from "@/lib/supabaseClient";
import { calculateSM2, QUALITY, SM2State } from "@/lib/sm2";
import type { Session } from "@supabase/supabase-js";

interface Card extends SM2State {
  id: string;
  front: string;
  back: string;
}

export default function ReviewPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [loading, setLoading] = useState(true);

  const [deckTitle, setDeckTitle] = useState("");
  const [cards, setCards] = useState<Card[]>([]);
  const [reviewMode, setReviewMode] = useState<"due" | "all">("due");

  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Authentication check
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setCheckingAuth(false);
      if (!data.session) router.push("/");
    });
  }, [router]);

  // Load cards and deck info
  useEffect(() => {
    if (!session) return;

    async function loadDeckData() {
      setLoading(true);
      const { data: deck, error: deckErr } = await supabase
        .from("decks")
        .select("title")
        .eq("id", params.id)
        .single();

      if (deckErr || !deck) {
        router.push("/decks");
        return;
      }

      const { data: cardRows } = await supabase
        .from("cards")
        .select("*")
        .eq("deck_id", params.id);

      setDeckTitle(deck.title);
      setCards((cardRows as Card[]) ?? []);
      setLoading(false);
    }

    loadDeckData();
  }, [session, params.id, router]);

  // Filter cards based on mode
  const now = new Date().toISOString();
  const dueCards = cards.filter((c) => c.next_review_date <= now);
  const activeCards = reviewMode === "due" ? dueCards : cards;
  const current = activeCards[index];

  const advance = useCallback(() => {
    setFlipped(false);
    setIndex((i) => i + 1);
  }, []);

  const handleAnswer = useCallback(
    async (quality: 0 | 3 | 5) => {
      if (!current) return;
      const nextState = calculateSM2(current, quality);

      advance();

      // Optimistically update card locally to reflect changes
      setCards((prev) =>
        prev.map((c) =>
          c.id === current.id
            ? {
                ...c,
                interval: nextState.interval,
                ease_factor: nextState.ease_factor,
                repetitions: nextState.repetitions,
                next_review_date: nextState.next_review_date,
              }
            : c
        )
      );

      const persist = () =>
        supabase
          .from("cards")
          .update({
            interval: nextState.interval,
            ease_factor: nextState.ease_factor,
            repetitions: nextState.repetitions,
            next_review_date: nextState.next_review_date,
          })
          .eq("id", current.id);

      const { error } = await persist();
      if (error) {
        const retry = await persist();
        if (retry.error) {
          setToast("Couldn't save that review — will retry on your next visit.");
          setTimeout(() => setToast(null), 4000);
        }
      }
    },
    [current, advance]
  );

  // Keyboard shortcut listeners
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.code === "Space") {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (e.key === "1") {
        handleAnswer(QUALITY.WRONG);
      } else if (e.key === "2") {
        handleAnswer(QUALITY.HARD);
      } else if (e.key === "3") {
        handleAnswer(QUALITY.EASY);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleAnswer]);

  if (checkingAuth || loading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="h-6 w-6 rounded-full border-2 border-accent border-t-transparent animate-spin" />
      </div>
    );
  }

  // If there are no cards in the deck at all
  if (cards.length === 0) {
    return (
      <main className="max-w-xl mx-auto px-6 py-24 text-center">
        <h2 className="font-display text-2xl font-bold mb-4">{deckTitle || "Deck"}</h2>
        <p className="text-muted text-sm mb-6">There are no cards in this deck yet.</p>
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => router.push("/decks")}
            className="px-5 py-2.5 rounded-xl border border-ink/10 dark:border-paper/10 text-xs font-semibold"
          >
            ← My Decks
          </button>
          <button
            onClick={() => router.push("/")}
            className="px-5 py-2.5 rounded-xl bg-accent text-white text-xs font-semibold shadow-sm"
          >
            Generate Cards
          </button>
        </div>
      </main>
    );
  }

  // End of current card set
  if (!current) {
    return (
      <motion.main
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="max-w-xl mx-auto px-6 py-20 text-center"
      >
        <div className="bg-white dark:bg-white/5 border border-ink/10 dark:border-paper/10 rounded-3xl p-8 shadow-sm">
          <span className="h-12 w-12 rounded-full bg-accent/15 text-accent flex items-center justify-center text-xl mx-auto mb-4">
            🎉
          </span>
          <h2 className="font-display text-2xl font-bold mb-2">Review Complete!</h2>
          <p className="text-sm text-muted mb-6 leading-relaxed">
            {reviewMode === "due"
              ? "All due cards have been successfully reviewed."
              : "You completed studying all cards in this deck."}
          </p>

          <div className="flex flex-col gap-2.5 max-w-xs mx-auto">
            {reviewMode === "due" && cards.length > 0 && (
              <button
                onClick={() => {
                  setReviewMode("all");
                  setIndex(0);
                  setFlipped(false);
                }}
                className="w-full bg-ink dark:bg-paper text-paper dark:text-ink py-2.5 rounded-xl text-xs font-bold shadow-sm"
              >
                Practice All Cards ({cards.length})
              </button>
            )}
            <button
              onClick={() => router.push(`/deck/${params.id}/quiz`)}
              className="w-full bg-accent text-white py-2.5 rounded-xl text-xs font-bold shadow-sm shadow-accent/15"
            >
              Take the Quiz →
            </button>
            <button
              onClick={() => router.push("/decks")}
              className="w-full border border-ink/10 dark:border-paper/10 text-muted py-2.5 rounded-xl text-xs font-bold"
            >
              Back to My Decks
            </button>
          </div>
        </div>
      </motion.main>
    );
  }

  const pct = Math.round((index / activeCards.length) * 100);

  return (
    <main className="max-w-xl mx-auto px-6 py-12">
      {/* Header Info */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <button
            onClick={() => router.push("/decks")}
            className="text-xs text-muted hover:text-accent font-semibold transition-colors flex items-center gap-1.5"
          >
            <span>←</span> Back to Decks
          </button>
          <h1 className="font-display text-xl font-bold mt-2">{deckTitle}</h1>
        </div>
        <div className="text-right">
          <span className="text-xs font-bold text-accent bg-accent/15 px-2.5 py-1 rounded-full">
            {reviewMode === "due" ? "Due Review" : "Practice Mode"}
          </span>
          <p className="text-[10px] text-muted mt-1.5">
            Card {index + 1} of {activeCards.length}
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-1 bg-ink/5 dark:bg-paper/5 rounded-full overflow-hidden mb-8">
        <motion.div
          className="h-full bg-accent"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Flashcard Component */}
      <AnimatePresence mode="wait">
        <motion.div
          key={current.id}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
          onClick={() => setFlipped((f) => !f)}
          className="cursor-pointer"
        >
          <FlipCard front={current.front} back={current.back} flipped={flipped} />
        </motion.div>
      </AnimatePresence>

      {/* Control Buttons */}
      <div className="flex gap-3 mt-8 justify-center">
        <motion.button
          whileTap={{ scale: 0.94 }}
          onClick={() => handleAnswer(QUALITY.WRONG)}
          className="px-6 py-3 rounded-2xl bg-accent2 text-white text-xs font-bold shadow-sm shadow-accent2/10"
        >
          Wrong (1)
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.94 }}
          onClick={() => handleAnswer(QUALITY.HARD)}
          className="px-6 py-3 rounded-2xl bg-ink/80 dark:bg-paper/80 text-white dark:text-ink text-xs font-bold shadow-sm"
        >
          Hard (2)
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.94 }}
          onClick={() => handleAnswer(QUALITY.EASY)}
          className="px-6 py-3 rounded-2xl bg-accent text-white text-xs font-bold shadow-sm shadow-accent/15"
        >
          Easy (3)
        </motion.button>
      </div>

      {/* Keyboard Helper Cheat Sheet */}
      <div className="mt-8 text-center bg-paper/40 dark:bg-white/5 border border-ink/5 dark:border-paper/5 rounded-xl py-2 px-4 max-w-xs mx-auto">
        <p className="text-[10px] text-muted font-medium">
          <span className="font-bold text-ink dark:text-paper bg-white dark:bg-ink border border-ink/10 dark:border-paper/10 px-1 py-0.5 rounded shadow-sm mr-1">Space</span> to flip · 
          <span className="font-bold text-ink dark:text-paper bg-white dark:bg-ink border border-ink/10 dark:border-paper/10 px-1 py-0.5 rounded shadow-sm mx-1">1</span> 
          <span className="font-bold text-ink dark:text-paper bg-white dark:bg-ink border border-ink/10 dark:border-paper/10 px-1 py-0.5 rounded shadow-sm mx-1">2</span> 
          <span className="font-bold text-ink dark:text-paper bg-white dark:bg-ink border border-ink/10 dark:border-paper/10 px-1 py-0.5 rounded shadow-sm mx-1">3</span> for grades
        </p>
      </div>

      {/* Toast Alert */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-ink dark:bg-paper text-paper dark:text-ink text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg border border-ink/10 dark:border-paper/10"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}