"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabaseClient";
import type { Session } from "@supabase/supabase-js";

interface Card {
  id: string;
  front: string;
  back: string;
}

interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
}

export default function EditDeckPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [loading, setLoading] = useState(true);

  // Deck info
  const [deckTitle, setDeckTitle] = useState("");
  const [cards, setCards] = useState<Card[]>([]);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);

  // Page state
  const [tab, setTab] = useState<"cards" | "quiz">("cards");
  const [savingDeck, setSavingDeck] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // New Card State
  const [newFront, setNewFront] = useState("");
  const [newBack, setNewBack] = useState("");
  const [isAddingCard, setIsAddingCard] = useState(false);

  // New Quiz State
  const [newQuestion, setNewQuestion] = useState("");
  const [newOptions, setNewOptions] = useState(["", "", "", ""]);
  const [newCorrectIndex, setNewCorrectIndex] = useState(0);
  const [newExplanation, setNewExplanation] = useState("");
  const [isAddingQuestion, setIsAddingQuestion] = useState(false);

  // Auth Guard
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setCheckingAuth(false);
      if (!data.session) router.push("/");
    });
  }, [router]);

  // Load Deck Data
  useEffect(() => {
    if (!session) return;

    async function loadData() {
      setLoading(true);
      const { data: deck } = await supabase
        .from("decks")
        .select("title, is_public")
        .eq("id", params.id)
        .single();

      if (!deck) {
        router.push("/decks");
        return;
      }

      const { data: cardRows } = await supabase
        .from("cards")
        .select("id, front, back")
        .eq("deck_id", params.id);

      const { data: quizRows } = await supabase
        .from("quiz_questions")
        .select("id, question, options, correct_index, explanation")
        .eq("deck_id", params.id);

      setDeckTitle(deck.title);
      setIsPublic(deck.is_public);
      setCards((cardRows as Card[]) ?? []);
      setQuizQuestions((quizRows as QuizQuestion[]) ?? []);
      setLoading(false);
    }

    loadData();
  }, [session, params.id, router]);

  // Show status feedback helper
  const triggerStatus = (text: string, type: "success" | "error") => {
    setStatusMessage({ text, type });
    setTimeout(() => setStatusMessage(null), 3000);
  };

  // Toggle Public Sharing Setting
  const handleTogglePublic = async (checked: boolean) => {
    setIsPublic(checked);
    const { error } = await supabase
      .from("decks")
      .update({ is_public: checked })
      .eq("id", params.id);

    if (error) {
      setIsPublic(!checked);
      triggerStatus("Failed to update sharing setting.", "error");
    } else {
      triggerStatus(
        checked ? "Deck is now public in Community Library!" : "Deck is now private.",
        "success"
      );
    }
  };

  // Save Deck Title
  const handleSaveTitle = async () => {
    if (!deckTitle.trim()) return;
    setSavingDeck(true);
    const { error } = await supabase
      .from("decks")
      .update({ title: deckTitle })
      .eq("id", params.id);
    setSavingDeck(false);

    if (error) {
      triggerStatus("Failed to update deck title.", "error");
    } else {
      triggerStatus("Deck title updated successfully!", "success");
    }
  };

  // Card Management
  const handleUpdateCard = async (cardId: string, front: string, back: string) => {
    if (!front.trim() || !back.trim()) {
      triggerStatus("Card front and back content cannot be empty.", "error");
      return;
    }
    const { error } = await supabase
      .from("cards")
      .update({ front, back })
      .eq("id", cardId);

    if (error) {
      triggerStatus("Failed to update card.", "error");
    } else {
      triggerStatus("Card updated!", "success");
    }
  };

  const handleDeleteCard = async (cardId: string) => {
    if (!confirm("Are you sure you want to delete this card?")) return;
    const { error } = await supabase.from("cards").delete().eq("id", cardId);

    if (error) {
      triggerStatus("Failed to delete card.", "error");
    } else {
      setCards((prev) => prev.filter((c) => c.id !== cardId));
      triggerStatus("Card deleted.", "success");
    }
  };

  const handleCreateCard = async () => {
    if (!newFront.trim() || !newBack.trim()) {
      triggerStatus("Front and Back fields cannot be empty.", "error");
      return;
    }
    setIsAddingCard(true);
    const { data, error } = await supabase
      .from("cards")
      .insert({
        deck_id: params.id,
        front: newFront,
        back: newBack,
      })
      .select()
      .single();
    setIsAddingCard(false);

    if (error) {
      triggerStatus("Failed to create card.", "error");
    } else {
      setCards((prev) => [...prev, data as Card]);
      setNewFront("");
      setNewBack("");
      triggerStatus("Card added successfully!", "success");
    }
  };

  // Quiz Management
  const handleUpdateQuestion = async (
    qId: string,
    question: string,
    options: string[],
    correctIndex: number,
    explanation: string
  ) => {
    if (!question.trim() || options.some((o) => !o.trim())) {
      triggerStatus("Question and options content cannot be empty.", "error");
      return;
    }
    const { error } = await supabase
      .from("quiz_questions")
      .update({
        question,
        options,
        correct_index: correctIndex,
        explanation,
      })
      .eq("id", qId);

    if (error) {
      triggerStatus("Failed to update question.", "error");
    } else {
      triggerStatus("Quiz question updated!", "success");
    }
  };

  const handleDeleteQuestion = async (qId: string) => {
    if (!confirm("Are you sure you want to delete this question?")) return;
    const { error } = await supabase.from("quiz_questions").delete().eq("id", qId);

    if (error) {
      triggerStatus("Failed to delete question.", "error");
    } else {
      setQuizQuestions((prev) => prev.filter((q) => q.id !== qId));
      triggerStatus("Question deleted.", "success");
    }
  };

  const handleCreateQuestion = async () => {
    if (!newQuestion.trim() || newOptions.some((o) => !o.trim())) {
      triggerStatus("Question and options fields cannot be empty.", "error");
      return;
    }
    setIsAddingQuestion(true);
    const { data, error } = await supabase
      .from("quiz_questions")
      .insert({
        deck_id: params.id,
        question: newQuestion,
        options: newOptions,
        correct_index: newCorrectIndex,
        explanation: newExplanation,
      })
      .select()
      .single();
    setIsAddingQuestion(false);

    if (error) {
      triggerStatus("Failed to create question.", "error");
    } else {
      setQuizQuestions((prev) => [...prev, data as QuizQuestion]);
      setNewQuestion("");
      setNewOptions(["", "", "", ""]);
      setNewCorrectIndex(0);
      setNewExplanation("");
      triggerStatus("Question added successfully!", "success");
    }
  };

  if (checkingAuth || loading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="h-6 w-6 rounded-full border-2 border-accent border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <main className="max-w-3xl mx-auto px-6 py-12">
      {/* Header Back Button */}
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={() => router.push("/decks")}
          className="text-xs text-muted hover:text-accent font-semibold transition-colors flex items-center gap-1.5"
        >
          <span>←</span> Back to Decks
        </button>
        <span className="text-xs text-muted">Deck Customization Page</span>
      </div>

      {/* Title Editor Card */}
      <div className="bg-white dark:bg-white/5 border border-ink/10 dark:border-paper/10 rounded-3xl p-6 shadow-sm mb-8">
        <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">Deck Title</label>
        <div className="flex gap-3 mb-4">
          <input
            type="text"
            className="flex-1 px-4 py-3 rounded-xl border border-ink/10 dark:border-paper/10 bg-paper/30 dark:bg-ink/30 text-sm focus:outline-none focus:border-accent transition-colors font-semibold"
            value={deckTitle}
            onChange={(e) => setDeckTitle(e.target.value)}
          />
          <button
            onClick={handleSaveTitle}
            disabled={savingDeck}
            className="bg-accent text-white px-5 rounded-xl font-bold text-xs shadow-md shadow-accent/15 transition-all disabled:opacity-50 flex items-center justify-center"
          >
            {savingDeck ? "Saving..." : "Save Title"}
          </button>
        </div>

        {/* Public Sharing Toggle */}
        <div className="flex items-center justify-between pt-4 border-t border-ink/5 dark:border-paper/5">
          <div>
            <h4 className="text-xs font-bold text-ink dark:text-paper">Community Sharing</h4>
            <p className="text-[10px] text-muted">Allow other students to discover, practice, and clone this deck.</p>
          </div>
          <button
            onClick={() => handleTogglePublic(!isPublic)}
            className={`w-12 h-6 rounded-full p-0.5 transition-colors focus:outline-none relative flex items-center ${
              isPublic ? "bg-accent justify-end" : "bg-ink/10 dark:bg-paper/10 justify-start"
            }`}
            aria-label="Toggle public deck visibility"
          >
            <motion.div
              layout
              className="w-5 h-5 rounded-full bg-white shadow-sm"
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          </button>
        </div>
      </div>

      {/* Tab Selectors */}
      <div className="flex gap-2 mb-8 bg-paper/50 dark:bg-white/5 p-1 rounded-2xl border border-ink/5 dark:border-paper/5">
        <button
          onClick={() => setTab("cards")}
          className={`flex-1 py-2.5 text-center rounded-xl text-xs font-bold transition-all ${
            tab === "cards"
              ? "bg-white dark:bg-white/10 text-ink dark:text-paper shadow-sm border border-ink/5 dark:border-paper/5"
              : "text-muted hover:text-ink dark:hover:text-paper"
          }`}
        >
          Flashcards Editor ({cards.length})
        </button>
        <button
          onClick={() => setTab("quiz")}
          className={`flex-1 py-2.5 text-center rounded-xl text-xs font-bold transition-all ${
            tab === "quiz"
              ? "bg-white dark:bg-white/10 text-ink dark:text-paper shadow-sm border border-ink/5 dark:border-paper/5"
              : "text-muted hover:text-ink dark:hover:text-paper"
          }`}
        >
          Quiz Questions Editor ({quizQuestions.length})
        </button>
      </div>

      {/* Flashcards Editor Tab */}
      <AnimatePresence mode="wait">
        {tab === "cards" ? (
          <motion.div
            key="cards-editor"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
          >
            {/* Add New Card Section */}
            <div className="bg-white dark:bg-white/5 border border-ink/10 dark:border-paper/10 rounded-3xl p-6 shadow-sm">
              <h3 className="font-display text-sm font-bold mb-4">Add New Card</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] text-muted font-bold uppercase tracking-wider mb-1">Front (Question)</label>
                  <textarea
                    rows={2}
                    className="w-full px-4 py-2.5 rounded-xl border border-ink/10 dark:border-paper/10 bg-paper/30 dark:bg-ink/30 text-xs focus:outline-none focus:border-accent transition-colors"
                    placeholder="Enter card question..."
                    value={newFront}
                    onChange={(e) => setNewFront(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-muted font-bold uppercase tracking-wider mb-1">Back (Answer)</label>
                  <textarea
                    rows={2}
                    className="w-full px-4 py-2.5 rounded-xl border border-ink/10 dark:border-paper/10 bg-paper/30 dark:bg-ink/30 text-xs focus:outline-none focus:border-accent transition-colors"
                    placeholder="Enter card answer..."
                    value={newBack}
                    onChange={(e) => setNewBack(e.target.value)}
                  />
                </div>
                <button
                  onClick={handleCreateCard}
                  disabled={isAddingCard}
                  className="w-full bg-accent text-white py-2.5 rounded-xl font-bold text-xs shadow-md shadow-accent/15 transition-all flex items-center justify-center"
                >
                  {isAddingCard ? "Adding..." : "+ Create Card"}
                </button>
              </div>
            </div>

            {/* Cards List */}
            <div className="space-y-4">
              <h3 className="font-display text-base font-bold pl-1">Cards in Deck</h3>
              {cards.map((c, idx) => (
                <div
                  key={c.id}
                  className="bg-white dark:bg-white/5 border border-ink/10 dark:border-paper/10 rounded-3xl p-5 shadow-sm space-y-4"
                >
                  <div className="flex items-center justify-between border-b border-ink/5 dark:border-paper/5 pb-2">
                    <span className="text-[10px] font-bold text-accent">Card #{idx + 1}</span>
                    <button
                      onClick={() => handleDeleteCard(c.id)}
                      className="text-[10px] font-bold text-accent2 hover:opacity-85"
                    >
                      Delete Card
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[9px] text-muted font-bold uppercase tracking-wider mb-1">Front</label>
                      <textarea
                        rows={3}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-ink/10 dark:border-paper/10 bg-paper/30 dark:bg-ink/30 text-xs focus:outline-none focus:border-accent transition-colors"
                        value={c.front}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCards((prev) => prev.map((item) => (item.id === c.id ? { ...item, front: val } : item)));
                        }}
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] text-muted font-bold uppercase tracking-wider mb-1">Back</label>
                      <textarea
                        rows={3}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-ink/10 dark:border-paper/10 bg-paper/30 dark:bg-ink/30 text-xs focus:outline-none focus:border-accent transition-colors"
                        value={c.back}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCards((prev) => prev.map((item) => (item.id === c.id ? { ...item, back: val } : item)));
                        }}
                      />
                    </div>
                  </div>

                  <button
                    onClick={() => handleUpdateCard(c.id, c.front, c.back)}
                    className="w-full border border-accent/20 text-accent hover:bg-accent/5 py-2 rounded-xl text-xs font-bold transition-all"
                  >
                    Save Changes
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        ) : (
          /* Quiz Editor Tab */
          <motion.div
            key="quiz-editor"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
          >
            {/* Add New Question Section */}
            <div className="bg-white dark:bg-white/5 border border-ink/10 dark:border-paper/10 rounded-3xl p-6 shadow-sm">
              <h3 className="font-display text-sm font-bold mb-4">Add New Quiz Question</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] text-muted font-bold uppercase tracking-wider mb-1">Question</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2.5 rounded-xl border border-ink/10 dark:border-paper/10 bg-paper/30 dark:bg-ink/30 text-xs focus:outline-none focus:border-accent transition-colors"
                    placeholder="Enter question text..."
                    value={newQuestion}
                    onChange={(e) => setNewQuestion(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {newOptions.map((opt, oIdx) => (
                    <div key={oIdx}>
                      <label className="block text-[9px] text-muted font-bold uppercase tracking-wider mb-1">Option {["A", "B", "C", "D"][oIdx]}</label>
                      <input
                        type="text"
                        className="w-full px-3.5 py-2 rounded-xl border border-ink/10 dark:border-paper/10 bg-paper/30 dark:bg-ink/30 text-xs focus:outline-none focus:border-accent transition-colors"
                        value={opt}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNewOptions((prev) => {
                            const copy = [...prev];
                            copy[oIdx] = val;
                            return copy;
                          });
                        }}
                      />
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] text-muted font-bold uppercase tracking-wider mb-1">Correct Answer</label>
                    <select
                      value={newCorrectIndex}
                      onChange={(e) => setNewCorrectIndex(Number(e.target.value))}
                      className="w-full border border-ink/10 dark:border-paper/10 rounded-xl px-3 py-2 bg-paper/30 dark:bg-ink/30 text-xs font-semibold focus:outline-none cursor-pointer"
                    >
                      <option value={0}>Option A</option>
                      <option value={1}>Option B</option>
                      <option value={2}>Option C</option>
                      <option value={3}>Option D</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-muted font-bold uppercase tracking-wider mb-1">Explanation</label>
                    <input
                      type="text"
                      className="w-full px-4 py-2.5 rounded-xl border border-ink/10 dark:border-paper/10 bg-paper/30 dark:bg-ink/30 text-xs focus:outline-none focus:border-accent transition-colors"
                      placeholder="Why is it correct?"
                      value={newExplanation}
                      onChange={(e) => setNewExplanation(e.target.value)}
                    />
                  </div>
                </div>
                <button
                  onClick={handleCreateQuestion}
                  disabled={isAddingQuestion}
                  className="w-full bg-accent text-white py-2.5 rounded-xl font-bold text-xs shadow-md shadow-accent/15 transition-all flex items-center justify-center"
                >
                  {isAddingQuestion ? "Adding..." : "+ Create Question"}
                </button>
              </div>
            </div>

            {/* Questions List */}
            <div className="space-y-4">
              <h3 className="font-display text-base font-bold pl-1">Questions in Deck</h3>
              {quizQuestions.map((q, idx) => (
                <div
                  key={q.id}
                  className="bg-white dark:bg-white/5 border border-ink/10 dark:border-paper/10 rounded-3xl p-5 shadow-sm space-y-4"
                >
                  <div className="flex items-center justify-between border-b border-ink/5 dark:border-paper/5 pb-2">
                    <span className="text-[10px] font-bold text-accent">Question #{idx + 1}</span>
                    <button
                      onClick={() => handleDeleteQuestion(q.id)}
                      className="text-[10px] font-bold text-accent2 hover:opacity-85"
                    >
                      Delete Question
                    </button>
                  </div>

                  <div>
                    <label className="block text-[9px] text-muted font-bold uppercase tracking-wider mb-1">Question Text</label>
                    <input
                      type="text"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-ink/10 dark:border-paper/10 bg-paper/30 dark:bg-ink/30 text-xs focus:outline-none focus:border-accent transition-colors"
                      value={q.question}
                      onChange={(e) => {
                        const val = e.target.value;
                        setQuizQuestions((prev) =>
                          prev.map((item) => (item.id === q.id ? { ...item, question: val } : item))
                        );
                      }}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {q.options.map((opt, oIdx) => (
                      <div key={oIdx}>
                        <label className="block text-[9px] text-muted font-bold uppercase tracking-wider mb-1">Option {["A", "B", "C", "D"][oIdx]}</label>
                        <input
                          type="text"
                          className="w-full px-3.5 py-2 rounded-xl border border-ink/10 dark:border-paper/10 bg-paper/30 dark:bg-ink/30 text-xs focus:outline-none focus:border-accent transition-colors"
                          value={opt}
                          onChange={(e) => {
                            const val = e.target.value;
                            setQuizQuestions((prev) =>
                              prev.map((item) => {
                                if (item.id === q.id) {
                                  const opts = [...item.options];
                                  opts[oIdx] = val;
                                  return { ...item, options: opts };
                                }
                                return item;
                              })
                            );
                          }}
                        />
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[9px] text-muted font-bold uppercase tracking-wider mb-1">Correct Option</label>
                      <select
                        value={q.correct_index}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setQuizQuestions((prev) =>
                            prev.map((item) => (item.id === q.id ? { ...item, correct_index: val } : item))
                          );
                        }}
                        className="w-full border border-ink/10 dark:border-paper/10 rounded-xl px-3 py-2 bg-paper/30 dark:bg-ink/30 text-xs font-semibold focus:outline-none cursor-pointer"
                      >
                        <option value={0}>Option A</option>
                        <option value={1}>Option B</option>
                        <option value={2}>Option C</option>
                        <option value={3}>Option D</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[9px] text-muted font-bold uppercase tracking-wider mb-1">Explanation</label>
                      <input
                        type="text"
                        className="w-full px-3.5 py-2 rounded-xl border border-ink/10 dark:border-paper/10 bg-paper/30 dark:bg-ink/30 text-xs focus:outline-none focus:border-accent transition-colors"
                        value={q.explanation}
                        onChange={(e) => {
                          const val = e.target.value;
                          setQuizQuestions((prev) =>
                            prev.map((item) => (item.id === q.id ? { ...item, explanation: val } : item))
                          );
                        }}
                      />
                    </div>
                  </div>

                  <button
                    onClick={() => handleUpdateQuestion(q.id, q.question, q.options, q.correct_index, q.explanation)}
                    className="w-full border border-accent/20 text-accent hover:bg-accent/5 py-2 rounded-xl text-xs font-bold transition-all"
                  >
                    Save Changes
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Status Notification */}
      <AnimatePresence>
        {statusMessage && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className={`fixed bottom-6 left-1/2 -translate-x-1/2 text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg border ${
              statusMessage.type === "success"
                ? "bg-accent/15 border-accent/25 text-accent"
                : "bg-accent2/15 border-accent2/25 text-accent2"
            }`}
          >
            {statusMessage.text}
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
