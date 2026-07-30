"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabaseClient";
import type { Session } from "@supabase/supabase-js";

interface PublicDeck {
  id: string;
  title: string;
  source_type: string;
  difficulty: string;
  user_id: string;
  created_at: string;
  cardCount?: number;
}

export default function DiscoverPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [loading, setLoading] = useState(true);
  const [decks, setDecks] = useState<PublicDeck[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [cloningId, setCloningId] = useState<string | null>(null);
  const [status, setStatus] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Preview States
  const [previewDeckId, setPreviewDeckId] = useState<string | null>(null);
  const [previewCards, setPreviewCards] = useState<{ front: string; back: string }[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setCheckingAuth(false);
      if (!data.session) router.push("/");
    });
  }, [router]);

  async function loadPublicDecks() {
    setLoading(true);
    // Fetch all public decks (RLS policies ensure we only get is_public = true or our own)
    const { data: deckRows, error } = await supabase
      .from("decks")
      .select("id, title, source_type, difficulty, user_id, created_at")
      .eq("is_public", true)
      .order("created_at", { ascending: false });

    if (error || !deckRows) {
      setDecks([]);
      setLoading(false);
      return;
    }

    const deckIds = deckRows.map((d) => d.id);
    if (deckIds.length === 0) {
      setDecks([]);
      setLoading(false);
      return;
    }

    // Fetch card counts for each deck
    const { data: cardRows } = await supabase
      .from("cards")
      .select("deck_id")
      .in("deck_id", deckIds);

    const merged = deckRows.map((d) => {
      const count = (cardRows ?? []).filter((c) => c.deck_id === d.id).length;
      return { ...d, cardCount: count };
    });

    setDecks(merged);
    setLoading(false);
  }

  useEffect(() => {
    if (session) {
      loadPublicDecks();
    }
  }, [session]);

  const triggerStatus = (text: string, type: "success" | "error") => {
    setStatus({ text, type });
    setTimeout(() => setStatus(null), 3000);
  };

  // Preview cards logic
  const handlePreviewDeck = async (deckId: string) => {
    if (previewDeckId === deckId) {
      setPreviewDeckId(null);
      return;
    }
    setPreviewDeckId(deckId);
    setLoadingPreview(true);
    setPreviewCards([]);

    const { data, error } = await supabase
      .from("cards")
      .select("front, back")
      .eq("deck_id", deckId)
      .limit(5);

    if (data) {
      setPreviewCards(data);
    }
    setLoadingPreview(false);
  };

  // Clone/Copy Deck logic
  const handleCloneDeck = async (sourceDeck: PublicDeck) => {
    if (!session) return;
    setCloningId(sourceDeck.id);

    try {
      // 1. Create duplicate deck metadata
      const { data: newDeck, error: deckErr } = await supabase
        .from("decks")
        .insert({
          user_id: session.user.id,
          title: `${sourceDeck.title} (Cloned)`,
          source_type: sourceDeck.source_type,
          difficulty: sourceDeck.difficulty,
          is_public: false, // cloned decks are private by default
        })
        .select()
        .single();

      if (deckErr) throw deckErr;

      // 2. Fetch all cards belonging to source deck
      const { data: cardsData, error: cardsErr } = await supabase
        .from("cards")
        .select("front, back")
        .eq("deck_id", sourceDeck.id);

      if (cardsErr) throw cardsErr;

      if (cardsData && cardsData.length > 0) {
        await supabase.from("cards").insert(
          cardsData.map((c) => ({
            deck_id: newDeck.id,
            front: c.front,
            back: c.back,
          }))
        );
      }

      // 3. Fetch all quiz questions belonging to source deck
      const { data: quizData } = await supabase
        .from("quiz_questions")
        .select("question, options, correct_index, explanation")
        .eq("deck_id", sourceDeck.id);

      if (quizData && quizData.length > 0) {
        await supabase.from("quiz_questions").insert(
          quizData.map((q) => ({
            deck_id: newDeck.id,
            question: q.question,
            options: q.options,
            correct_index: q.correct_index,
            explanation: q.explanation,
          }))
        );
      }

      triggerStatus(`"${sourceDeck.title}" cloned successfully to My Decks!`, "success");
    } catch (e) {
      console.error(e);
      triggerStatus("Failed to clone deck. Please try again.", "error");
    } finally {
      setCloningId(null);
    }
  };

  const filteredDecks = decks.filter(
    (deck) =>
      deck.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      deck.difficulty.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (checkingAuth || !session) return null;

  return (
    <main className="max-w-4xl mx-auto px-6 py-12 animate-none">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="font-display text-4xl font-extrabold tracking-tight bg-gradient-to-r from-ink to-ink/75 dark:from-paper dark:to-paper/75 bg-clip-text text-transparent">
          Community Library
        </h1>
        <p className="text-xs text-muted mt-1 leading-relaxed">
          Browse public study decks shared by the community and import them to your study space.
        </p>
      </div>

      {/* Search and Filters */}
      <div className="mb-8">
        <input
          type="text"
          className="w-full px-4 py-2.5 rounded-xl border border-ink/10 dark:border-paper/10 bg-white dark:bg-white/5 text-xs focus:outline-none focus:border-accent transition-colors"
          placeholder="Search public decks by title or difficulty..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="h-6 w-6 rounded-full border-2 border-accent border-t-transparent animate-spin" />
        </div>
      )}

      {!loading && filteredDecks.length === 0 && (
        <div className="text-center py-16 bg-white dark:bg-white/5 border border-ink/10 dark:border-paper/10 rounded-3xl p-8 shadow-sm">
          <span className="text-4xl mb-4 block">🌐</span>
          <h2 className="font-display text-xl font-bold mb-2">No Public Decks Yet</h2>
          <p className="text-xs text-muted max-w-sm mx-auto leading-relaxed">
            Decks made "Public" by students will appear here. Go to "My Decks" &rarr; "Edit" to share yours!
          </p>
        </div>
      )}

      {/* Decks Grid */}
      <ul className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredDecks.map((deck) => (
          <li
            key={deck.id}
            className="p-5 bg-white dark:bg-white/5 border border-ink/10 dark:border-paper/10 rounded-2xl flex flex-col justify-between hover:border-accent/30 transition-all shadow-sm"
          >
            <div>
              <div className="flex justify-between items-start gap-4">
                <h2 className="font-display text-base font-bold leading-snug line-clamp-2">
                  {deck.title}
                </h2>
                <span className="text-[9px] text-muted font-bold tracking-wider bg-paper dark:bg-ink border border-ink/5 dark:border-paper/5 px-2 py-0.5 rounded">
                  {deck.difficulty.toUpperCase()}
                </span>
              </div>

              {/* Creator details */}
              <p className="text-[9px] text-muted font-bold mt-1.5 uppercase tracking-wide">
                SHARED BY: {deck.user_id.slice(0, 8)}...
              </p>

              {/* Badges & card counts */}
              <div className="flex gap-2 mt-4 flex-wrap">
                <span className="text-[9px] font-bold uppercase px-2 py-0.5 bg-paper dark:bg-ink text-muted border border-ink/5 dark:border-paper/5 rounded">
                  {deck.source_type}
                </span>
                <span className="text-[9px] font-bold uppercase px-2 py-0.5 bg-accent/10 text-accent border border-accent/25 rounded">
                  {deck.cardCount ?? 0} Cards
                </span>
              </div>
            </div>

            {/* Preview Section */}
            {previewDeckId === deck.id && (
              <div className="mt-4 pt-4 border-t border-ink/5 dark:border-paper/5 space-y-2 bg-paper/30 dark:bg-ink/30 p-3 rounded-xl">
                <h4 className="text-[10px] font-bold text-accent uppercase tracking-wider">Deck Preview (First 5 Cards)</h4>
                {loadingPreview ? (
                  <p className="text-[10px] text-muted animate-pulse">Loading preview cards...</p>
                ) : previewCards.length === 0 ? (
                  <p className="text-[10px] text-muted">No cards inside this deck.</p>
                ) : (
                  <ul className="space-y-1.5 max-h-40 overflow-y-auto">
                    {previewCards.map((c, cIdx) => (
                      <li key={cIdx} className="text-[10px] leading-relaxed border-b border-ink/5 dark:border-paper/5 last:border-0 pb-1 last:pb-0">
                        <span className="font-bold text-ink dark:text-paper">Q:</span> {c.front}
                        <br />
                        <span className="italic text-muted font-medium">A: {c.back.slice(0, 60)}{c.back.length > 60 ? "..." : ""}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 mt-6 pt-4 border-t border-ink/5 dark:border-paper/5 flex-wrap">
              <button
                onClick={() => handlePreviewDeck(deck.id)}
                className="text-[11px] border border-ink/10 dark:border-paper/10 text-ink dark:text-paper hover:bg-ink/5 dark:hover:bg-paper/5 px-4 py-2 rounded-xl font-bold transition-all"
              >
                {previewDeckId === deck.id ? "Close Preview" : "👁️ Preview Cards"}
              </button>

              <button
                onClick={() => handleCloneDeck(deck)}
                disabled={cloningId === deck.id}
                className="text-[11px] bg-accent text-white px-4 py-2 rounded-xl font-bold transition-all shadow-sm shadow-accent/15 disabled:opacity-50 ml-auto flex items-center gap-1.5"
              >
                {cloningId === deck.id ? (
                  <>
                    <span className="h-3 w-3 rounded-full border border-white border-t-transparent animate-spin" />
                    Importing...
                  </>
                ) : (
                  "📥 Import to My Decks"
                )}
              </button>
            </div>
          </li>
        ))}
      </ul>

      {/* Floating Status Notification Toast */}
      <AnimatePresence>
        {status && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className={`fixed bottom-6 left-1/2 -translate-x-1/2 text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg border ${
              status.type === "success"
                ? "bg-accent text-white border-accent/20"
                : "bg-accent2 text-white border-accent2/20"
            }`}
          >
            {status.text}
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
