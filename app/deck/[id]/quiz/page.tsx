"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabaseClient";
import CopilotDrawer from "@/components/CopilotDrawer";
import type { Session } from "@supabase/supabase-js";

interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
}

const KEY_TO_INDEX: Record<string, number> = { a: 0, b: 1, c: 2, d: 3 };

export default function QuizPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [loading, setLoading] = useState(true);

  const [deckTitle, setDeckTitle] = useState("");
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [userAnswers, setUserAnswers] = useState<number[]>([]);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [savingResult, setSavingResult] = useState(false);

  // Copilot Drawer States
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [copilotCardFront, setCopilotCardFront] = useState("");
  const [copilotCardBack, setCopilotCardBack] = useState("");

  // Authentication check
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setCheckingAuth(false);
      if (!data.session) router.push("/");
    });
  }, [router]);

  // Load questions and deck info
  useEffect(() => {
    if (!session) return;

    async function loadQuizData() {
      setLoading(true);
      const { data: deck } = await supabase
        .from("decks")
        .select("title")
        .eq("id", params.id)
        .single();

      const { data: questionRows } = await supabase
        .from("quiz_questions")
        .select("*")
        .eq("deck_id", params.id);

      if (deck) setDeckTitle(deck.title);
      setQuestions((questionRows as QuizQuestion[]) ?? []);
      setLoading(false);
    }

    loadQuizData();
  }, [session, params.id]);

  const current = questions[index];

  const selectOption = useCallback(
    (optionIndex: number) => {
      if (selected !== null || !current) return;
      setSelected(optionIndex);

      setUserAnswers((prev) => {
        const copy = [...prev];
        copy[index] = optionIndex;
        return copy;
      });

      if (optionIndex === current.correct_index) {
        setScore((s) => s + 1);
      }
    },
    [selected, current, index]
  );

  const proceed = useCallback(async () => {
    if (selected === null || !session) return;
    if (index + 1 < questions.length) {
      setIndex((i) => i + 1);
      setSelected(null);
    } else {
      setSavingResult(true);
      setFinished(true);

      // Explicitly include user_id to prevent null-constraint errors in supabase
      await supabase.from("quiz_attempts").insert({
        deck_id: params.id,
        user_id: session.user.id,
        score: score,
        total: questions.length,
      });
      setSavingResult(false);
    }
  }, [selected, index, questions.length, score, params.id, session]);

  // Keyboard shortcut listener
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (isCopilotOpen) return;
      const key = e.key.toLowerCase();
      if (key in KEY_TO_INDEX) selectOption(KEY_TO_INDEX[key]);
      if (e.key === "Enter") proceed();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectOption, proceed, isCopilotOpen]);

  const triggerCopilot = (question: string, correctOpt: string, explanation: string, options: string[]) => {
    setCopilotCardFront(question);
    setCopilotCardBack(
      `Correct Answer: ${correctOpt}\nOptions: ${options.join(", ")}\nExplanation: ${explanation}`
    );
    setIsCopilotOpen(true);
  };

  const resetQuiz = () => {
    setIndex(0);
    setSelected(null);
    setUserAnswers([]);
    setScore(0);
    setFinished(false);
  };

  if (checkingAuth || loading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="h-6 w-6 rounded-full border-2 border-accent border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!questions.length) {
    return (
      <main className="max-w-xl mx-auto px-6 py-24 text-center">
        <h2 className="font-display text-2xl font-bold mb-4">{deckTitle || "Deck"}</h2>
        <p className="text-muted text-sm mb-6">No quiz questions found for this deck.</p>
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
            Generate Quiz
          </button>
        </div>
      </main>
    );
  }

  // Quiz Finished / Score Screen
  if (finished) {
    const pct = Math.round((score / questions.length) * 100);
    return (
      <motion.main
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-2xl mx-auto px-6 py-12"
      >
        <div className="bg-white dark:bg-white/5 border border-ink/10 dark:border-paper/10 rounded-3xl p-8 shadow-sm text-center mb-8">
          <span className="text-4xl mb-4 block">🏆</span>
          <h1 className="font-display text-3xl font-extrabold mb-1">
            {score} / {questions.length}
          </h1>
          <p className="text-sm font-semibold text-accent mb-2">{pct}% Correct</p>
          <p className="text-xs text-muted mb-6">
            Quiz successfully completed and logged.
          </p>

          <div className="flex flex-wrap gap-2.5 justify-center">
            <button
              onClick={resetQuiz}
              className="px-5 py-2.5 bg-ink dark:bg-paper text-paper dark:text-ink rounded-xl text-xs font-bold shadow-sm"
            >
              Retry Quiz
            </button>
            <button
              onClick={() => router.push(`/deck/${params.id}/review`)}
              className="px-5 py-2.5 bg-accent text-white rounded-xl text-xs font-bold shadow-sm"
            >
              Review Cards
            </button>
            <button
              onClick={() => router.push("/decks")}
              className="px-5 py-2.5 border border-ink/10 dark:border-paper/10 text-muted rounded-xl text-xs font-bold"
            >
              My Decks
            </button>
          </div>
        </div>

        {/* Detailed Question Review Panel */}
        <div className="bg-white dark:bg-white/5 border border-ink/10 dark:border-paper/10 rounded-3xl p-6 shadow-sm">
          <h2 className="font-display text-lg font-bold mb-4 border-b border-ink/5 dark:border-paper/5 pb-3">
            Review Questions
          </h2>

          <div className="space-y-6">
            {questions.map((q, qIdx) => {
              const selectedOpt = userAnswers[qIdx];
              const isUserCorrect = selectedOpt === q.correct_index;

              return (
                <div key={q.id} className="border-b border-ink/5 dark:border-paper/5 pb-5 last:border-0 last:pb-0">
                  <div className="flex items-start gap-2.5 mb-3">
                    <span
                      className={`h-5 w-5 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold ${
                        isUserCorrect
                          ? "bg-accent/15 text-accent"
                          : "bg-accent2/15 text-accent2"
                      }`}
                    >
                      {isUserCorrect ? "✓" : "✗"}
                    </span>
                    <h3 className="text-sm font-semibold leading-relaxed">
                      {qIdx + 1}. {q.question}
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-7 mb-3">
                    {q.options.map((opt, optIdx) => {
                      const isCorrect = optIdx === q.correct_index;
                      const isSelected = optIdx === selectedOpt;

                      let style = "bg-paper/30 border-ink/5 dark:border-paper/5 text-muted";
                      if (isCorrect) {
                        style = "bg-accent/15 border-accent/30 text-accent font-semibold";
                      } else if (isSelected && !isCorrect) {
                        style = "bg-accent2/15 border-accent2/30 text-accent2 font-semibold";
                      }

                      return (
                        <div key={optIdx} className={`px-3.5 py-2 rounded-xl border text-xs font-medium ${style}`}>
                          <span className="opacity-60 mr-1">{["A", "B", "C", "D"][optIdx]}.</span>
                          {opt}
                        </div>
                      );
                    })}
                  </div>

                  {/* Explanation box with Copilot trigger */}
                  <div className="pl-7 flex flex-col sm:flex-row items-start sm:items-center justify-between bg-paper/20 dark:bg-white/5 rounded-xl p-3 border border-ink/5 dark:border-paper/5 gap-3">
                    <div className="text-xs text-muted leading-relaxed flex-1">
                      <span className="font-bold text-accent">Explanation:</span> {q.explanation}
                    </div>
                    <button
                      onClick={() =>
                        triggerCopilot(q.question, q.options[q.correct_index], q.explanation, q.options)
                      }
                      className="px-3 py-1.5 border border-ink/10 dark:border-paper/10 text-muted hover:text-accent rounded-xl text-[10px] font-bold transition-all bg-white dark:bg-ink/30 shrink-0 flex items-center gap-1 shadow-sm"
                    >
                      <span>🤖</span> Ask Copilot
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Copilot Drawer overlay */}
        <CopilotDrawer
          isOpen={isCopilotOpen}
          onClose={() => setIsCopilotOpen(false)}
          cardFront={copilotCardFront}
          cardBack={copilotCardBack}
        />
      </motion.main>
    );
  }

  const pct = Math.round((index / questions.length) * 100);

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
            Active Quiz
          </span>
          <p className="text-[10px] text-muted mt-1.5">
            Question {index + 1} of {questions.length}
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

      {/* Question Card */}
      <div className="bg-white dark:bg-white/5 border border-ink/10 dark:border-paper/10 rounded-3xl p-6 shadow-sm mb-6">
        <h2 className="font-display text-lg font-bold mb-6 leading-relaxed text-ink dark:text-paper">
          {current.question}
        </h2>

        <div className="space-y-3">
          {current.options.map((opt, i) => {
            const isCorrect = i === current.correct_index;
            const isSelected = i === selected;
            const showState = selected !== null;

            let btnStyle = "border-ink/10 dark:border-paper/10 bg-paper/20 dark:bg-white/5 hover:border-ink/20 dark:hover:border-paper/20";
            if (showState) {
              if (isCorrect) {
                btnStyle = "bg-accent/10 border-accent text-accent font-semibold";
              } else if (isSelected) {
                btnStyle = "bg-accent2/10 border-accent2 text-accent2 font-semibold";
              } else {
                btnStyle = "border-ink/5 dark:border-paper/5 opacity-55";
              }
            }

            return (
              <motion.button
                key={i}
                whileTap={{ scale: 0.98 }}
                animate={
                  showState && isCorrect
                    ? { scale: [1, 1.015, 1] }
                    : showState && isSelected && !isCorrect
                    ? { x: [0, -4, 4, -3, 3, 0] }
                    : {}
                }
                transition={{ duration: 0.35 }}
                onClick={() => selectOption(i)}
                className={`w-full text-left p-4 rounded-2xl border transition-all flex items-center text-xs font-semibold ${btnStyle}`}
              >
                <span className="text-muted mr-3 bg-white dark:bg-ink/50 border border-ink/10 dark:border-paper/10 h-6 w-6 rounded-lg flex items-center justify-center text-[10px]">
                  {["A", "B", "C", "D"][i]}
                </span>
                <span className="flex-1 leading-normal">{opt}</span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Answer Explanation & Next Buttons */}
      <AnimatePresence>
        {selected !== null && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="bg-white dark:bg-white/5 border border-ink/10 dark:border-paper/10 rounded-3xl p-6 shadow-sm space-y-4"
          >
            <div className="text-xs text-muted leading-relaxed p-3 bg-paper/20 dark:bg-white/5 rounded-xl border border-ink/5 dark:border-paper/5">
              <span className="font-bold text-accent block mb-1">Explanation:</span>
              {current.explanation}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() =>
                  triggerCopilot(current.question, current.options[current.correct_index], current.explanation, current.options)
                }
                className="px-5 py-3 border border-ink/10 dark:border-paper/10 text-muted hover:text-accent hover:border-accent/30 rounded-2xl text-xs font-bold transition-all bg-paper/20 dark:bg-white/5 flex items-center justify-center gap-1.5 shadow-sm shrink-0"
              >
                <span>🤖</span> Ask Copilot
              </button>

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={proceed}
                className="flex-1 bg-ink dark:bg-paper text-paper dark:text-ink py-3 rounded-2xl text-xs font-bold shadow-md hover:opacity-95 transition-all flex items-center justify-center gap-1.5"
              >
                {index + 1 < questions.length ? "Next Question (Enter)" : "Finish Quiz (Enter)"}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Keyboard Helpers */}
      <div className="mt-8 text-center bg-paper/40 dark:bg-white/5 border border-ink/5 dark:border-paper/5 rounded-xl py-2 px-4 max-w-xs mx-auto">
        <p className="text-[10px] text-muted font-medium">
          Press <span className="font-bold text-ink dark:text-paper bg-white dark:bg-ink border border-ink/10 dark:border-paper/10 px-1 py-0.5 rounded shadow-sm">A</span>
          <span className="font-bold text-ink dark:text-paper bg-white dark:bg-ink border border-ink/10 dark:border-paper/10 px-1 py-0.5 rounded shadow-sm mx-0.5">B</span>
          <span className="font-bold text-ink dark:text-paper bg-white dark:bg-ink border border-ink/10 dark:border-paper/10 px-1 py-0.5 rounded shadow-sm mx-0.5">C</span>
          <span className="font-bold text-ink dark:text-paper bg-white dark:bg-ink border border-ink/10 dark:border-paper/10 px-1 py-0.5 rounded shadow-sm mx-0.5">D</span> to select ·
          <span className="font-bold text-ink dark:text-paper bg-white dark:bg-ink border border-ink/10 dark:border-paper/10 px-1 py-0.5 rounded shadow-sm ml-1">Enter</span> to proceed
        </p>
      </div>

      {/* Copilot Drawer overlay */}
      <CopilotDrawer
        isOpen={isCopilotOpen}
        onClose={() => setIsCopilotOpen(false)}
        cardFront={copilotCardFront}
        cardBack={copilotCardBack}
      />
    </main>
  );
}