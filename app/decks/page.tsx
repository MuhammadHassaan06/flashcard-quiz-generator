"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import { exportDeckToAnki } from "@/lib/ankiExport";
import { parseImportText } from "@/lib/import";

interface Deck {
  id: string;
  title: string;
  source_type: string;
  difficulty: string;
  created_at: string;
  totalCards: number;
  dueCards: number;
  lastAttempt: { score: number; total: number } | null;
}

export default function DecksPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [exportingId, setExportingId] = useState<string | null>(null);

  // Import Deck Modal States
  const [showImportModal, setShowImportModal] = useState(false);
  const [importTitle, setImportTitle] = useState("");
  const [importRawText, setImportRawText] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  // Merge Decks States
  const [isMergeMode, setIsMergeMode] = useState(false);
  const [selectedMergeIds, setSelectedMergeIds] = useState<string[]>([]);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergeTitle, setMergeTitle] = useState("");
  const [merging, setMerging] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setCheckingAuth(false);
      if (!data.session) router.push("/");
    });
  }, [router]);

  async function loadDecks() {
    if (!session) return;
    setLoading(true);

    const { data: deckRows } = await supabase
      .from("decks")
      .select("id, title, source_type, difficulty, created_at")
      .order("created_at", { ascending: false });

    const deckIds = (deckRows ?? []).map((d) => d.id);
    if (!deckIds.length) {
      setDecks([]);
      setLoading(false);
      return;
    }

    const [{ data: cardRows }, { data: attemptRows }] = await Promise.all([
      supabase.from("cards").select("deck_id, next_review_date").in("deck_id", deckIds),
      supabase
        .from("quiz_attempts")
        .select("deck_id, score, total, attempted_at")
        .in("deck_id", deckIds)
        .order("attempted_at", { ascending: false }),
    ]);

    const now = new Date().toISOString();
    const merged: Deck[] = (deckRows ?? []).map((d) => {
      const deckCards = (cardRows ?? []).filter((c) => c.deck_id === d.id);
      const dueCards = deckCards.filter((c) => c.next_review_date <= now).length;
      const lastAttempt = (attemptRows ?? []).find((a) => a.deck_id === d.id);
      return {
        ...d,
        totalCards: deckCards.length,
        dueCards,
        lastAttempt: lastAttempt ? { score: lastAttempt.score, total: lastAttempt.total } : null,
      };
    });

    setDecks(merged);
    setLoading(false);
  }

  useEffect(() => {
    if (session) {
      loadDecks();
    }
  }, [session]);

  async function handleExport(deck: Deck) {
    setExportingId(deck.id);
    try {
      const { data } = await supabase.from("cards").select("front, back").eq("deck_id", deck.id);
      exportDeckToAnki(deck.title, data ?? []);
    } catch (e) {
      console.error("Export failed", e);
    } finally {
      setExportingId(null);
    }
  }

  async function handleDelete(deckId: string) {
    if (!confirm("Delete this deck permanently? This removes its cards and quiz too.")) return;
    setDecks((prev) => prev.filter((d) => d.id !== deckId));
    await supabase.from("decks").delete().eq("id", deckId);
  }

  // Handle Import Submission
  async function handleImportSubmit() {
    if (!session) return;
    setImportError(null);

    const parsedCards = parseImportText(importRawText);
    if (parsedCards.length === 0) {
      setImportError("No valid flashcard lines detected. Format cards as: Question,Answer or Question[Tab]Answer");
      return;
    }

    setImporting(true);
    try {
      const { data: deck, error: deckErr } = await supabase
        .from("decks")
        .insert({
          user_id: session.user.id,
          title: importTitle.trim() || "Imported Deck",
          source_type: "text",
          difficulty: "basic",
        })
        .select()
        .single();

      if (deckErr) throw deckErr;

      const { error: cardsErr } = await supabase.from("cards").insert(
        parsedCards.map((c) => ({
          deck_id: deck.id,
          front: c.front,
          back: c.back,
        }))
      );

      if (cardsErr) throw cardsErr;

      // Reset Form & Reload
      setShowImportModal(false);
      setImportTitle("");
      setImportRawText("");
      loadDecks();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Failed to import deck.");
    } finally {
      setImporting(false);
    }
  }

  // Toggle Deck Selection for Merging
  const handleToggleSelectMerge = (deckId: string) => {
    setSelectedMergeIds((prev) =>
      prev.includes(deckId) ? prev.filter((id) => id !== deckId) : [...prev, deckId]
    );
  };

  // Handle Deck Merging
  async function handleMergeSubmit() {
    if (!session || selectedMergeIds.length < 2) return;
    setMerging(true);

    try {
      // 1. Create a combined deck metadata
      const { data: deck, error: deckErr } = await supabase
        .from("decks")
        .insert({
          user_id: session.user.id,
          title: mergeTitle.trim() || "Combined Deck",
          source_type: "text",
          difficulty: "basic",
        })
        .select()
        .single();

      if (deckErr) throw deckErr;

      // 2. Fetch and duplicate all cards
      const { data: cardsData } = await supabase
        .from("cards")
        .select("front, back")
        .in("deck_id", selectedMergeIds);

      if (cardsData && cardsData.length > 0) {
        await supabase.from("cards").insert(
          cardsData.map((c) => ({
            deck_id: deck.id,
            front: c.front,
            back: c.back,
          }))
        );
      }

      // 3. Fetch and duplicate all quiz questions
      const { data: quizData } = await supabase
        .from("quiz_questions")
        .select("question, options, correct_index, explanation")
        .in("deck_id", selectedMergeIds);

      if (quizData && quizData.length > 0) {
        await supabase.from("quiz_questions").insert(
          quizData.map((q) => ({
            deck_id: deck.id,
            question: q.question,
            options: q.options,
            correct_index: q.correct_index,
            explanation: q.explanation,
          }))
        );
      }

      // Reset Merging state & Reload
      setShowMergeModal(false);
      setIsMergeMode(false);
      setSelectedMergeIds([]);
      setMergeTitle("");
      loadDecks();
    } catch (e) {
      console.error(e);
    } finally {
      setMerging(false);
    }
  }

  const filteredDecks = decks.filter((deck) =>
    deck.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalCardsSum = decks.reduce((sum, d) => sum + d.totalCards, 0);
  const totalDueSum = decks.reduce((sum, d) => sum + d.dueCards, 0);

  if (checkingAuth || !session) return null;

  return (
    <main className="max-w-4xl mx-auto px-6 py-12">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight bg-gradient-to-r from-ink to-ink/75 dark:from-paper dark:to-paper/75 bg-clip-text text-transparent">
            My Study Decks
          </h1>
          <p className="text-xs text-muted mt-1 leading-relaxed">
            Manage card decks, review due flashcards, or test your comprehension with a quiz.
          </p>
        </div>
        <Link
          href="/"
          className="bg-accent text-white px-5 py-2.5 rounded-xl font-bold text-xs tracking-wide shadow-md shadow-accent/15 hover:opacity-95 transition-all text-center self-start md:self-center animate-none"
        >
          + Generate New Deck
        </Link>
      </div>

      {/* Stats Summary Panel */}
      {decks.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white dark:bg-white/5 border border-ink/10 dark:border-paper/10 rounded-2xl p-4 shadow-sm">
            <span className="text-[10px] text-muted font-bold uppercase tracking-wider block mb-1">
              Total Decks
            </span>
            <span className="text-xl font-display font-extrabold text-ink dark:text-paper">
              {decks.length}
            </span>
          </div>
          <div className="bg-white dark:bg-white/5 border border-ink/10 dark:border-paper/10 rounded-2xl p-4 shadow-sm">
            <span className="text-[10px] text-muted font-bold uppercase tracking-wider block mb-1">
              Total Flashcards
            </span>
            <span className="text-xl font-display font-extrabold text-ink dark:text-paper">
              {totalCardsSum}
            </span>
          </div>
          <div className="bg-white dark:bg-white/5 border border-ink/10 dark:border-paper/10 rounded-2xl p-4 shadow-sm col-span-2 sm:col-span-1">
            <span className="text-[10px] text-muted font-bold uppercase tracking-wider block mb-1">
              Due For Review
            </span>
            <span className={`text-xl font-display font-extrabold ${totalDueSum > 0 ? "text-accent" : "text-muted"}`}>
              {totalDueSum}
            </span>
          </div>
        </div>
      )}

      {/* Actions Toolbar: CSV Import and Merge Buttons */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <button
          onClick={() => setShowImportModal(true)}
          className="bg-white dark:bg-white/5 border border-ink/10 dark:border-paper/10 text-ink dark:text-paper hover:border-accent hover:text-accent px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
        >
          📥 Import CSV/TSV
        </button>

        <button
          onClick={() => {
            setIsMergeMode(!isMergeMode);
            setSelectedMergeIds([]);
          }}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm border ${
            isMergeMode
              ? "bg-accent/15 border-accent text-accent font-semibold"
              : "bg-white dark:bg-white/5 border-ink/10 dark:border-paper/10 text-ink dark:text-paper hover:border-accent hover:text-accent"
          }`}
        >
          🛠️ {isMergeMode ? "Cancel Merge" : "Merge Decks"}
        </button>

        {isMergeMode && selectedMergeIds.length >= 2 && (
          <motion.button
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={() => setShowMergeModal(true)}
            className="bg-accent text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md shadow-accent/15 flex items-center gap-1"
          >
            Combine {selectedMergeIds.length} Decks
          </motion.button>
        )}
      </div>

      {/* Search Input */}
      {decks.length > 0 && (
        <div className="mb-6">
          <input
            type="text"
            className="w-full px-4 py-2.5 rounded-xl border border-ink/10 dark:border-paper/10 bg-white dark:bg-white/5 text-xs focus:outline-none focus:border-accent transition-colors"
            placeholder="Search decks by title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="h-6 w-6 rounded-full border-2 border-accent border-t-transparent animate-spin" />
        </div>
      )}

      {!loading && decks.length === 0 && (
        <div className="text-center py-16 bg-white dark:bg-white/5 border border-ink/10 dark:border-paper/10 rounded-3xl p-8 shadow-sm">
          <span className="text-4xl mb-4 block">📚</span>
          <h2 className="font-display text-xl font-bold mb-2">No Decks Found</h2>
          <p className="text-xs text-muted mb-6 max-w-sm mx-auto leading-relaxed">
            You don't have any flashcard decks created yet. Get started by entering notes or a webpage link.
          </p>
          <Link
            href="/"
            className="bg-accent text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-md"
          >
            Create Your First Deck
          </Link>
        </div>
      )}

      {!loading && decks.length > 0 && filteredDecks.length === 0 && (
        <p className="text-muted text-xs text-center py-12">No decks match your search query.</p>
      )}

      {/* Decks Grid */}
      <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <AnimatePresence>
          {filteredDecks.map((deck, i) => {
            const isSelected = selectedMergeIds.includes(deck.id);
            return (
              <motion.li
                key={deck.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: i * 0.03, duration: 0.25 }}
                onClick={() => {
                  if (isMergeMode) handleToggleSelectMerge(deck.id);
                }}
                className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                  isMergeMode ? "cursor-pointer" : ""
                } ${
                  isSelected
                    ? "bg-accent/5 border-accent shadow-sm"
                    : "bg-white dark:bg-white/5 border-ink/10 dark:border-paper/10 hover:border-accent/30"
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-2.5">
                      {isMergeMode && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}} // handled by li onClick
                          className="h-4 w-4 rounded border-ink/20 text-accent focus:ring-accent"
                        />
                      )}
                      <h2 className="font-display text-base font-bold leading-snug line-clamp-2">
                        {deck.title}
                      </h2>
                    </div>
                    {!isMergeMode && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(deck.id);
                        }}
                        className="text-[10px] text-accent2 hover:opacity-85 font-bold transition-opacity flex-shrink-0"
                      >
                        Delete
                      </button>
                    )}
                  </div>

                  {/* Deck Badges */}
                  <div className="flex gap-1.5 mt-2.5 flex-wrap">
                    <span className="text-[9px] font-bold tracking-wide uppercase px-2 py-0.5 rounded-md bg-paper dark:bg-ink text-muted border border-ink/5 dark:border-paper/5">
                      {deck.source_type}
                    </span>
                    <span className="text-[9px] font-bold tracking-wide uppercase px-2 py-0.5 rounded-md bg-paper dark:bg-ink text-muted border border-ink/5 dark:border-paper/5">
                      {deck.difficulty}
                    </span>
                    {deck.lastAttempt && (
                      <span className="text-[9px] font-bold tracking-wide uppercase px-2 py-0.5 rounded-md bg-accent/10 text-accent border border-accent/25">
                        Quiz: {deck.lastAttempt.score}/{deck.lastAttempt.total}
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-muted mt-4 font-medium">
                    <span className="font-bold text-ink dark:text-paper">{deck.totalCards}</span> cards total ·{" "}
                    <span className={deck.dueCards > 0 ? "font-bold text-accent" : "font-bold text-muted"}>
                      {deck.dueCards}
                    </span>{" "}
                    due now
                  </p>
                </div>

                {/* Action Buttons */}
                {!isMergeMode && (
                  <div className="flex gap-2 mt-5 pt-4 border-t border-ink/5 dark:border-paper/5 flex-wrap">
                    <Link
                      href={`/deck/${deck.id}/review`}
                      className={`text-[11px] px-3.5 py-1.5 rounded-xl font-bold transition-all ${
                        deck.dueCards > 0
                          ? "bg-accent text-white shadow-sm shadow-accent/15"
                          : "bg-ink dark:bg-paper text-paper dark:text-ink shadow-sm"
                      }`}
                    >
                      Review {deck.dueCards > 0 ? `(${deck.dueCards})` : ""}
                    </Link>

                    <Link
                      href={`/deck/${deck.id}/quiz`}
                      className="text-[11px] border border-ink/10 dark:border-paper/10 text-ink dark:text-paper hover:bg-ink/5 dark:hover:bg-paper/5 px-3.5 py-1.5 rounded-xl font-bold transition-all"
                    >
                      Take Quiz
                    </Link>

                    <Link
                      href={`/deck/${deck.id}/edit`}
                      className="text-[11px] border border-ink/10 dark:border-paper/10 text-ink dark:text-paper hover:bg-ink/5 dark:hover:bg-paper/5 px-3.5 py-1.5 rounded-xl font-bold transition-all"
                    >
                      Edit Deck
                    </Link>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleExport(deck);
                      }}
                      disabled={exportingId === deck.id}
                      className="text-[11px] border border-ink/10 dark:border-paper/10 text-muted hover:bg-ink/5 dark:hover:bg-paper/5 px-3.5 py-1.5 rounded-xl font-bold transition-all disabled:opacity-50 ml-auto"
                    >
                      {exportingId === deck.id ? "Exporting..." : "Export Anki"}
                    </button>
                  </div>
                )}
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>

      {/* CSV/TSV Import Modal */}
      <AnimatePresence>
        {showImportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-ink border border-ink/10 dark:border-paper/10 rounded-3xl p-6 w-full max-w-lg shadow-xl"
            >
              <h2 className="font-display text-lg font-bold mb-1">Import Flashcards</h2>
              <p className="text-[10px] text-muted mb-4">
                Paste Tab-Separated Values (TSV) or Comma-Separated Values (CSV).
              </p>

              {importError && (
                <div className="p-3 mb-4 bg-accent2/10 text-accent2 border border-accent2/25 rounded-xl text-xs font-semibold">
                  {importError}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">
                    Deck Title
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. My Custom Import"
                    value={importTitle}
                    onChange={(e) => setImportTitle(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-ink/10 dark:border-paper/10 bg-paper/30 dark:bg-ink/30 text-xs focus:outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">
                    CSV/TSV Content
                  </label>
                  <textarea
                    rows={8}
                    placeholder="Question 1&#09;Answer 1&#10;Question 2&#09;Answer 2&#10;or:&#10;Question 1,Answer 1"
                    value={importRawText}
                    onChange={(e) => setImportRawText(e.target.value)}
                    className="w-full p-4 rounded-xl border border-ink/10 dark:border-paper/10 bg-paper/30 dark:bg-ink/30 text-xs focus:outline-none focus:border-accent font-mono leading-relaxed"
                  />
                </div>

                <div className="flex gap-2 justify-end pt-2">
                  <button
                    onClick={() => {
                      setShowImportModal(false);
                      setImportError(null);
                    }}
                    className="px-4 py-2 text-xs font-bold text-muted border border-ink/10 dark:border-paper/10 rounded-xl hover:bg-ink/5 dark:hover:bg-paper/5 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleImportSubmit}
                    disabled={importing || !importRawText.trim()}
                    className="px-4 py-2 text-xs font-bold bg-accent text-white rounded-xl shadow-md disabled:opacity-50 transition-opacity"
                  >
                    {importing ? "Importing..." : "Save Deck"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Merge Confirmation Modal */}
      <AnimatePresence>
        {showMergeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-ink border border-ink/10 dark:border-paper/10 rounded-3xl p-6 w-full max-w-sm shadow-xl"
            >
              <h2 className="font-display text-lg font-bold mb-1">Merge Study Decks</h2>
              <p className="text-[10px] text-muted mb-4">
                This will combine all flashcards and quiz questions from the {selectedMergeIds.length} selected decks into a new deck.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">
                    Merged Deck Title
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Combined Terminology"
                    value={mergeTitle}
                    onChange={(e) => setMergeTitle(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-ink/10 dark:border-paper/10 bg-paper/30 dark:bg-ink/30 text-xs focus:outline-none focus:border-accent"
                  />
                </div>

                <div className="flex gap-2 justify-end pt-2">
                  <button
                    onClick={() => setShowMergeModal(false)}
                    className="px-4 py-2 text-xs font-bold text-muted border border-ink/10 dark:border-paper/10 rounded-xl hover:bg-ink/5 dark:hover:bg-paper/5 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleMergeSubmit}
                    disabled={merging}
                    className="px-4 py-2 text-xs font-bold bg-accent text-white rounded-xl shadow-md disabled:opacity-50 transition-opacity"
                  >
                    {merging ? "Merging..." : "Confirm Merge"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}