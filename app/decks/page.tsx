"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import { exportDeckToAnki } from "@/lib/ankiExport";

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

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setCheckingAuth(false);
      if (!data.session) router.push("/");
    });
  }, [router]);

  useEffect(() => {
    if (!session) return;

    async function loadDecks() {
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

    loadDecks();
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

  // Filter decks by search query
  const filteredDecks = decks.filter((deck) =>
    deck.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Statistics calculation
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
            Manage your card decks, practice spacing-repetition cards, or test your comprehension with a quiz.
          </p>
        </div>
        <Link
          href="/"
          className="bg-accent text-white px-5 py-2.5 rounded-xl font-bold text-xs tracking-wide shadow-md shadow-accent/15 hover:opacity-95 transition-all text-center self-start md:self-center"
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
          {filteredDecks.map((deck, i) => (
            <motion.li
              key={deck.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ delay: i * 0.03, duration: 0.25 }}
              className="p-5 rounded-2xl border border-ink/10 dark:border-paper/10 bg-white dark:bg-white/5 hover:border-accent/30 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-4">
                  <h2 className="font-display text-base font-bold leading-snug line-clamp-2">
                    {deck.title}
                  </h2>
                  <button
                    onClick={() => handleDelete(deck.id)}
                    className="text-[10px] text-accent2 hover:opacity-85 font-bold transition-opacity flex-shrink-0"
                  >
                    Delete
                  </button>
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
                  onClick={() => handleExport(deck)}
                  disabled={exportingId === deck.id}
                  className="text-[11px] border border-ink/10 dark:border-paper/10 text-muted hover:bg-ink/5 dark:hover:bg-paper/5 px-3.5 py-1.5 rounded-xl font-bold transition-all disabled:opacity-50 ml-auto"
                >
                  {exportingId === deck.id ? "Exporting..." : "Export Anki"}
                </button>
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </main>
  );
}