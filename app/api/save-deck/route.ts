import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

interface SaveDeckBody {
  title: string;
  sourceType: "text" | "url" | "file";
  difficulty: "basic" | "applied";
  flashcards: { front: string; back: string }[];
  quiz: {
    question: string;
    options: string[];
    correct_index: number;
    explanation: string;
  }[];
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");

  if (!token) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  // Client scoped to this user's token, so RLS policies apply normally —
  // the deck/cards/quiz rows are created as this user, not bypassed via
  // the service role key.
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !user) {
    return NextResponse.json({ error: "Invalid session." }, { status: 401 });
  }

  const body: SaveDeckBody = await req.json();

  if (!body.flashcards?.length && !body.quiz?.length) {
    return NextResponse.json({ error: "Nothing to save." }, { status: 400 });
  }

  const { data: deck, error: deckError } = await supabase
    .from("decks")
    .insert({
      user_id: user.id,
      title: body.title || "Untitled deck",
      source_type: body.sourceType,
      difficulty: body.difficulty,
    })
    .select()
    .single();

  if (deckError || !deck) {
    return NextResponse.json({ error: deckError?.message ?? "Failed to create deck." }, { status: 500 });
  }

  if (body.flashcards?.length) {
    const { error: cardsError } = await supabase.from("cards").insert(
      body.flashcards.map((c) => ({
        deck_id: deck.id,
        front: c.front,
        back: c.back,
        // interval/ease_factor/repetitions/next_review_date use their
        // table defaults (0, 2.5, 0, now()) so every card is due immediately.
      }))
    );
    if (cardsError) {
      return NextResponse.json({ error: cardsError.message }, { status: 500 });
    }
  }

  if (body.quiz?.length) {
    const { error: quizError } = await supabase.from("quiz_questions").insert(
      body.quiz.map((q) => ({
        deck_id: deck.id,
        question: q.question,
        options: q.options,
        correct_index: q.correct_index,
        explanation: q.explanation,
      }))
    );
    if (quizError) {
      return NextResponse.json({ error: quizError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ deckId: deck.id });
}
