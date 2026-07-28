"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import FlipCard from "@/components/FlipCard";
import CopilotDrawer from "@/components/CopilotDrawer";
import { supabase } from "@/lib/supabaseClient";
import { calculateSM2, QUALITY, SM2State } from "@/lib/sm2";
import { calculateMatchScore } from "@/lib/voiceMatch";
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

  // Copilot State
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);

  // TTS Voice Settings State
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceUri, setSelectedVoiceUri] = useState("");
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);

  // Speech Recognition / Voice Mode State
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcribedText, setTranscribedText] = useState("");
  const [matchScore, setMatchScore] = useState<number | null>(null);
  const [speechError, setSpeechError] = useState<string | null>(null);

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

  // Speech synthesis voice loading
  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const loadVoices = () => {
        const allVoices = window.speechSynthesis.getVoices();
        setVoices(allVoices);

        // Recover saved preference
        const saved = localStorage.getItem("tts_voice_uri");
        if (saved) {
          setSelectedVoiceUri(saved);
        } else if (allVoices.length > 0) {
          // Default to first English voice if available, or just the first voice
          const defaultEng = allVoices.find((v) => v.lang.startsWith("en-"));
          setSelectedVoiceUri(defaultEng ? defaultEng.voiceURI : allVoices[0].voiceURI);
        }
      };

      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;

      const savedRate = localStorage.getItem("tts_rate");
      if (savedRate) setPlaybackRate(parseFloat(savedRate));
    }
  }, []);

  // Filter cards based on mode
  const now = new Date().toISOString();
  const dueCards = cards.filter((c) => c.next_review_date <= now);
  const activeCards = reviewMode === "due" ? dueCards : cards;
  const current = activeCards[index];

  const advance = useCallback(() => {
    setFlipped(false);
    setMatchScore(null);
    setTranscribedText("");
    setSpeechError(null);
    setIndex((i) => i + 1);
  }, []);

  const handleAnswer = useCallback(
    async (quality: 0 | 3 | 5) => {
      if (!current || !session) return;
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

      // Track study session progress
      const logStudySession = async () => {
        const todayStr = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD local format
        try {
          const { data: existing } = await supabase
            .from("study_sessions")
            .select("id, cards_reviewed")
            .eq("user_id", session.user.id)
            .eq("date", todayStr)
            .maybeSingle();

          if (existing) {
            await supabase
              .from("study_sessions")
              .update({ cards_reviewed: existing.cards_reviewed + 1 })
              .eq("id", existing.id);
          } else {
            await supabase
              .from("study_sessions")
              .insert({ user_id: session.user.id, date: todayStr, cards_reviewed: 1 });
          }
        } catch (e) {
          console.error("Failed to log study session statistics", e);
        }
      };
      logStudySession();

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
    [current, advance, session]
  );

  // Keyboard shortcut listeners
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Don't listen to shortcuts if AI Drawer is open or user is typing in a text field
      if (isCopilotOpen || document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") {
        return;
      }
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
  }, [handleAnswer, isCopilotOpen]);

  // Voice Settings Handlers
  const handleVoiceChange = (uri: string) => {
    setSelectedVoiceUri(uri);
    localStorage.setItem("tts_voice_uri", uri);
  };

  const handleRateChange = (rate: number) => {
    setPlaybackRate(rate);
    localStorage.setItem("tts_rate", rate.toString());
  };

  // Speech Recognition Handler
  const startListening = () => {
    if (typeof window === "undefined") return;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeechError("Speech recognition is not supported in this browser.");
      return;
    }

    setSpeechError(null);
    setMatchScore(null);
    setTranscribedText("");

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onerror = (e: any) => {
      setSpeechError(e.error === "no-speech" ? "No speech detected. Please speak louder." : `Speech error: ${e.error}`);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setTranscribedText(transcript);
      if (current) {
        const score = calculateMatchScore(transcript, current.back);
        setMatchScore(score);
        setFlipped(true); // Flip card to reveal answer
      }
    };

    recognition.start();
  };

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
    <main className="max-w-xl mx-auto px-6 py-12 relative">
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
        <div className="text-right flex flex-col items-end gap-1.5">
          <span className="text-xs font-bold text-accent bg-accent/15 px-2.5 py-1 rounded-full">
            {reviewMode === "due" ? "Due Review" : "Practice Mode"}
          </span>
          <p className="text-[10px] text-muted">
            Card {index + 1} of {activeCards.length}
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-1 bg-ink/5 dark:bg-paper/5 rounded-full overflow-hidden mb-4">
        <motion.div
          className="h-full bg-accent"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Spaced Control Bar: TTS Settings & Voice Mode */}
      <div className="flex justify-between items-center mb-6 bg-paper/60 dark:bg-white/5 border border-ink/5 dark:border-paper/5 rounded-2xl px-4 py-2 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowVoiceSettings(!showVoiceSettings)}
            className={`text-[10px] font-bold transition-all px-2.5 py-1 rounded-lg border ${
              showVoiceSettings
                ? "bg-ink dark:bg-paper text-paper dark:text-ink border-ink dark:border-paper"
                : "border-ink/10 dark:border-paper/10 text-muted hover:bg-ink/5 dark:hover:bg-paper/5"
            }`}
          >
            ⚙️ TTS Voice Settings
          </button>

          <button
            onClick={() => setIsVoiceMode(!isVoiceMode)}
            className={`text-[10px] font-bold transition-all px-2.5 py-1 rounded-lg border flex items-center gap-1 ${
              isVoiceMode
                ? "bg-accent/15 border-accent text-accent"
                : "border-ink/10 dark:border-paper/10 text-muted hover:bg-ink/5 dark:hover:bg-paper/5"
            }`}
          >
            🎤 {isVoiceMode ? "Voice Mode: ON" : "Voice Mode: OFF"}
          </button>
        </div>
        
        {/* Quick Reset for current cards */}
        <button
          onClick={() => {
            setFlipped(false);
            setMatchScore(null);
            setTranscribedText("");
            setSpeechError(null);
          }}
          className="text-[10px] font-bold text-muted hover:text-ink dark:hover:text-paper"
        >
          Reset Card View
        </button>
      </div>

      {/* Voice Settings Drawer panel inside the screen */}
      <AnimatePresence>
        {showVoiceSettings && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mb-6 bg-white dark:bg-white/5 border border-ink/10 dark:border-paper/10 rounded-2xl p-4 space-y-3"
          >
            <div>
              <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1">
                Select Audio Accent/Voice
              </label>
              <select
                value={selectedVoiceUri}
                onChange={(e) => handleVoiceChange(e.target.value)}
                className="w-full border border-ink/10 dark:border-paper/10 rounded-xl px-3 py-1.5 bg-paper/50 dark:bg-ink/50 text-xs font-semibold focus:outline-none cursor-pointer"
              >
                {voices.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name} ({v.lang})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1 flex justify-between">
                <span>Speech Speed Rate</span>
                <span className="font-mono text-accent">{playbackRate}x</span>
              </label>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={playbackRate}
                onChange={(e) => handleRateChange(parseFloat(e.target.value))}
                className="w-full accent-accent bg-ink/10 dark:bg-paper/15 h-1 rounded"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Interactive Speech Recognition UI */}
      {isVoiceMode && (
        <div className="mb-6 p-4 bg-accent/5 border border-accent/20 rounded-3xl flex flex-col items-center justify-center text-center space-y-3">
          <p className="text-[10px] text-muted uppercase tracking-wider font-bold">Speech-to-Text Controller</p>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={startListening}
            disabled={isListening}
            className={`h-12 w-12 rounded-full flex items-center justify-center text-lg shadow-md transition-all ${
              isListening ? "bg-accent2 text-white animate-pulse" : "bg-accent text-white"
            }`}
          >
            {isListening ? "🔴" : "🎤"}
          </motion.button>
          <p className="text-xs font-medium text-ink dark:text-paper">
            {isListening ? "Listening... Speak your answer now." : "Click microphone to record your answer."}
          </p>

          {speechError && (
            <p className="text-[10px] text-accent2 font-semibold bg-accent2/10 px-3 py-1 rounded-xl">
              {speechError}
            </p>
          )}

          {transcribedText && (
            <div className="w-full space-y-1 bg-paper/50 dark:bg-ink/50 border border-ink/5 dark:border-paper/5 p-3 rounded-2xl text-left">
              <span className="text-[9px] text-muted font-bold block uppercase tracking-wider">Your Transcript</span>
              <p className="text-xs font-medium italic text-ink dark:text-paper">"{transcribedText}"</p>
              {matchScore !== null && (
                <div className="pt-2 mt-2 border-t border-ink/5 dark:border-paper/5 flex justify-between items-center flex-wrap gap-2">
                  <span className="text-[9px] text-muted font-bold uppercase tracking-wider">Match Percentage</span>
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-lg ${
                      matchScore >= 75
                        ? "bg-accent/15 text-accent"
                        : matchScore >= 40
                        ? "bg-amber-500/15 text-amber-500"
                        : "bg-accent2/15 text-accent2"
                    }`}
                  >
                    {matchScore}% Match
                  </span>
                  <p className="text-[10px] text-muted w-full mt-1">
                    {matchScore >= 75
                      ? "Excellent! Suggested Score: Easy (3)"
                      : matchScore >= 45
                      ? "Partial match. Suggested Score: Hard (2)"
                      : "Low similarity. Suggested Score: Wrong (1)"}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

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
      <div className="flex gap-3 mt-8 justify-center flex-wrap">
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
        <motion.button
          whileTap={{ scale: 0.94 }}
          onClick={() => setIsCopilotOpen(true)}
          className="px-5 py-3 rounded-2xl border border-ink/10 dark:border-paper/10 text-muted hover:text-accent hover:border-accent/40 bg-white dark:bg-white/5 text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
        >
          🤖 Ask Copilot
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

      {/* Recall Copilot Drawer */}
      <CopilotDrawer
        isOpen={isCopilotOpen}
        onClose={() => setIsCopilotOpen(false)}
        cardFront={current.front}
        cardBack={current.back}
      />
    </main>
  );
}