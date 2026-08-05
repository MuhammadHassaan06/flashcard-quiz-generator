"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabaseClient";
import type { Session } from "@supabase/supabase-js";

interface Card {
  id: string;
  front: string;
  back: string;
}

export default function PodcastPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const [deckTitle, setDeckTitle] = useState("");
  const [cards, setCards] = useState<Card[]>([]);
  const [index, setIndex] = useState(0);

  // Podcast Autoplay State
  const [isPlaying, setIsPlaying] = useState(false);
  const [stage, setStage] = useState<"speaking-question" | "thinking-pause" | "speaking-answer" | "idle">("idle");
  const [pauseDelay, setPauseDelay] = useState(4); // seconds pause between question & answer
  const [speechRate, setSpeechRate] = useState(1);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Authentication check
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (!data.session) router.push("/");
    });
  }, [router]);

  // Load cards & deck info
  useEffect(() => {
    if (!session) return;
    async function loadData() {
      setLoading(true);
      const { data: deck } = await supabase
        .from("decks")
        .select("title")
        .eq("id", params.id)
        .single();

      const { data: cardRows } = await supabase
        .from("cards")
        .select("id, front, back")
        .eq("deck_id", params.id);

      setDeckTitle(deck?.title || "Deck");
      setCards((cardRows as Card[]) || []);
      setLoading(false);
    }
    loadData();
  }, [session, params.id]);

  // Clean up speech synthesis on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const current = cards[index];

  // Continuous Autoplay Podcast Engine
  useEffect(() => {
    if (!isPlaying || !current || typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

    const synth = window.speechSynthesis;

    const playCycle = () => {
      synth.cancel();
      setStage("speaking-question");

      // 1. Read Question
      const qUtterance = new SpeechSynthesisUtterance(current.front);
      qUtterance.rate = speechRate;

      qUtterance.onend = () => {
        if (!isPlaying) return;
        setStage("thinking-pause");

        // 2. Pause for recall
        timeoutRef.current = setTimeout(() => {
          if (!isPlaying) return;
          setStage("speaking-answer");

          // 3. Read Answer
          const aUtterance = new SpeechSynthesisUtterance(`Answer: ${current.back}`);
          aUtterance.rate = speechRate;

          aUtterance.onend = () => {
            if (!isPlaying) return;

            // 4. Advance to next card after 1.5s
            timeoutRef.current = setTimeout(() => {
              if (index + 1 < cards.length) {
                setIndex((prev) => prev + 1);
              } else {
                setIsPlaying(false);
                setStage("idle");
              }
            }, 1500);
          };

          synth.speak(aUtterance);
        }, pauseDelay * 1000);
      };

      synth.speak(qUtterance);
    };

    playCycle();

    return () => {
      synth.cancel();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [isPlaying, index, current, pauseDelay, speechRate, cards.length]);

  const togglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false);
      setStage("idle");
      if (typeof window !== "undefined") window.speechSynthesis.cancel();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    } else {
      setIsPlaying(true);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="h-6 w-6 rounded-full border-2 border-accent border-t-transparent animate-spin" />
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <main className="max-w-md mx-auto px-6 py-24 text-center">
        <h2 className="font-display text-2xl font-bold mb-3">{deckTitle}</h2>
        <p className="text-sm text-muted mb-6">No cards found in this deck to play.</p>
        <button
          onClick={() => router.push("/decks")}
          className="px-5 py-2.5 rounded-xl bg-accent text-white text-xs font-bold shadow-sm"
        >
          ← Back to Decks
        </button>
      </main>
    );
  }

  const pct = Math.round(((index + 1) / cards.length) * 100);

  return (
    <main className="max-w-xl mx-auto px-6 py-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={() => router.push(`/deck/${params.id}/review`)}
          className="text-xs font-bold text-muted hover:text-accent flex items-center gap-1.5 transition-colors"
        >
          ← Back to Card Review
        </button>
        <span className="text-xs font-bold text-accent bg-accent/15 px-3 py-1 rounded-full flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
          Podcast Audio Mode
        </span>
      </div>

      {/* Main Podcast Audio Player Card */}
      <div className="bg-white dark:bg-white/5 border border-ink/10 dark:border-paper/10 rounded-3xl p-8 shadow-xl text-center relative overflow-hidden">
        {/* Animated Soundwave Header */}
        <div className="h-16 flex items-center justify-center gap-1 mb-6">
          {[0.4, 0.8, 0.3, 0.9, 0.5, 0.7, 0.2, 0.9, 0.6, 0.4].map((h, i) => (
            <motion.div
              key={i}
              className={`w-1.5 rounded-full ${
                isPlaying ? "bg-accent" : "bg-ink/10 dark:bg-paper/10"
              }`}
              animate={
                isPlaying
                  ? { height: ["12px", `${h * 48}px`, "12px"] }
                  : { height: "12px" }
              }
              transition={{
                duration: 0.6 + (i % 3) * 0.2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          ))}
        </div>

        {/* Deck Title & Track Status */}
        <h1 className="font-display text-2xl font-bold mb-1">{deckTitle}</h1>
        <p className="text-xs font-bold text-muted uppercase tracking-wider mb-6">
          Track {index + 1} of {cards.length}
        </p>

        {/* Current Active Card Content Preview */}
        <div className="bg-paper/50 dark:bg-ink/50 border border-ink/5 dark:border-paper/5 rounded-2xl p-6 mb-8 text-left min-h-[140px] flex flex-col justify-center space-y-3">
          <div>
            <span className="text-[9px] font-bold uppercase tracking-wider text-muted block mb-1">Question</span>
            <p className="font-display text-base font-bold text-ink dark:text-paper">{current.front}</p>
          </div>
          {(stage === "speaking-answer" || !isPlaying) && (
            <div className="pt-3 border-t border-ink/5 dark:border-paper/5">
              <span className="text-[9px] font-bold uppercase tracking-wider text-accent block mb-1">Answer</span>
              <p className="text-sm font-semibold text-accent leading-relaxed">{current.back}</p>
            </div>
          )}
        </div>

        {/* Status Indicator Pill */}
        <div className="mb-8">
          <span
            className={`text-xs font-bold px-4 py-1.5 rounded-full inline-block ${
              stage === "speaking-question"
                ? "bg-accent/15 text-accent"
                : stage === "thinking-pause"
                ? "bg-amber-500/15 text-amber-500 animate-pulse"
                : stage === "speaking-answer"
                ? "bg-emerald-600/15 text-emerald-600"
                : "bg-ink/5 dark:bg-paper/5 text-muted"
            }`}
          >
            {stage === "speaking-question"
              ? "🗣️ Reading Question..."
              : stage === "thinking-pause"
              ? `🧠 Pause for Recall (${pauseDelay}s)...`
              : stage === "speaking-answer"
              ? "💡 Reading Answer..."
              : "Paused"}
          </span>
        </div>

        {/* Player Controls */}
        <div className="flex items-center justify-center gap-4 mb-8">
          <button
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={index === 0}
            className="p-3 rounded-full border border-ink/10 dark:border-paper/10 text-muted hover:text-ink dark:hover:text-paper disabled:opacity-30"
          >
            ⏮️
          </button>
          <motion.button
            whileTap={{ scale: 0.94 }}
            onClick={togglePlay}
            className={`h-16 w-16 rounded-full flex items-center justify-center text-2xl text-white shadow-lg transition-all ${
              isPlaying ? "bg-amber-500" : "bg-accent shadow-accent/20"
            }`}
          >
            {isPlaying ? "⏸️" : "▶️"}
          </motion.button>
          <button
            onClick={() => setIndex((i) => Math.min(cards.length - 1, i + 1))}
            disabled={index === cards.length - 1}
            className="p-3 rounded-full border border-ink/10 dark:border-paper/10 text-muted hover:text-ink dark:hover:text-paper disabled:opacity-30"
          >
            ⏭️
          </button>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-1.5 bg-ink/5 dark:bg-paper/5 rounded-full overflow-hidden mb-6">
          <div className="h-full bg-accent transition-all duration-300" style={{ width: `${pct}%` }} />
        </div>

        {/* Settings Sliders */}
        <div className="grid grid-cols-2 gap-4 text-left pt-6 border-t border-ink/5 dark:border-paper/10">
          <div>
            <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1 flex justify-between">
              <span>Recall Pause</span>
              <span className="font-mono text-accent">{pauseDelay}s</span>
            </label>
            <input
              type="range"
              min="2"
              max="10"
              value={pauseDelay}
              onChange={(e) => setPauseDelay(parseInt(e.target.value))}
              className="w-full accent-accent bg-ink/10 dark:bg-paper/15 h-1 rounded cursor-pointer"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1 flex justify-between">
              <span>Audio Speed</span>
              <span className="font-mono text-accent">{speechRate}x</span>
            </label>
            <input
              type="range"
              min="0.7"
              max="1.8"
              step="0.1"
              value={speechRate}
              onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
              className="w-full accent-accent bg-ink/10 dark:bg-paper/15 h-1 rounded cursor-pointer"
            />
          </div>
        </div>
      </div>
    </main>
  );
}
