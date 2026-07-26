# AI Flashcard & Quiz Generator

Paste text, drop in a URL, or upload a PDF/DOCX — get AI-generated flashcards and a
quiz, with spaced repetition review, dark mode, and Anki export.

## Features

- **Multi-input generation** — paste text, paste a URL, or upload a PDF/DOCX
- **Long document handling** — automatic chunking + merging for large inputs, so
  generation doesn't get truncated or time out
- **Difficulty levels** — basic recall vs applied/conceptual questions
- **Spaced repetition (SM-2)** — flashcards use the standard SM-2 algorithm; cards
  you get wrong resurface sooner, cards you know well resurface later
- **Quiz mode** — multiple-choice questions with instant feedback and scoring
- **Auth** — email/password sign-up and sign-in (Supabase Auth)
- **My Decks dashboard** — see every saved deck, how many cards are due, and your
  last quiz score at a glance
- **Anki export** — download any deck as a tab-separated `.txt` file importable
  into Anki
- **Dark mode** — toggle, persisted across visits
- **Keyboard shortcuts** — Space to flip a card, 1/2/3 for Wrong/Hard/Easy,
  A/B/C/D + Enter in quiz mode
- **Smooth animations** — Framer Motion throughout (page transitions, card flips,
  list entries, button feedback)

## Tech stack

- **Framework:** Next.js 14 (App Router) + TypeScript
- **Styling:** Tailwind CSS (dark mode via `class` strategy)
- **Animation:** Framer Motion
- **Database + Auth:** Supabase (Postgres, Row Level Security, email/password auth)
- **AI generation:** pluggable — works with any chat-completion API (Claude,
  Groq, OpenAI, etc.) via `lib/chunkAndGenerate.ts`
- **Text extraction:** `cheerio` (URLs), `pdf-parse` (PDF), `mammoth` (DOCX)

## Project structure

```
app/
  page.tsx                    Home page — input, generation, save
  layout.tsx                  Root layout, dark-mode init script
  globals.css                 Tailwind + 3D flip-card CSS
  decks/page.tsx               My Decks dashboard
  deck/[id]/review/page.tsx    Flashcard review (SM-2, keyboard, optimistic UI)
  deck/[id]/quiz/page.tsx      Quiz mode (keyboard, scoring)
  api/generate/route.ts        Generation endpoint (extraction + chunking + AI call)
  api/save-deck/route.ts       Persists a generated deck to Supabase

components/
  AuthForm.tsx                 Sign in / sign up
  FlipCard.tsx                 3D flip flashcard
  StatusIndicator.tsx          Multi-step generation progress
  ThemeToggle.tsx               Dark mode toggle

lib/
  extract.ts                   URL/PDF/DOCX text extraction
  chunkAndGenerate.ts           Chunking, AI calls, JSON merging
  sm2.ts                        Spaced repetition algorithm
  ankiExport.ts                 Anki-format export
  supabaseClient.ts             Supabase client helpers

supabase/
  schema.sql                    Full DB schema (decks, cards, quiz_questions,
                                 quiz_attempts) with RLS policies
```

## Setup

### 1. Install dependencies
```
npm install
```

### 2. Set up Supabase
1. Create a free project at supabase.com.
2. In the SQL Editor, run the contents of `supabase/schema.sql` — this creates all
   tables and security policies.
3. Go to **Authentication → Providers → Email** and turn off **Confirm email**
   for easier local testing (re-enable it before going to production).
4. Copy your Project URL, anon key, and service role key from
   **Project Settings → API**.

### 3. Environment variables
Copy `.env.local.example` to `.env.local` and fill in:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```
Plus whichever AI provider key `lib/chunkAndGenerate.ts` is wired to
(e.g. `ANTHROPIC_API_KEY` or `GROQ_API_KEY`).

### 4. Run
```
npm run dev
```
Open http://localhost:3000.

## How it works

1. **Generate** (`/`) — pick an input method, optionally set a difficulty and
   title, click Generate. The backend extracts text, chunks it if it's long,
   calls the AI model per chunk, and merges the results into one deduplicated
   JSON payload of flashcards + quiz questions. Progress streams live into the
   multi-step status indicator.
2. **Save** — "Save & Start Review" persists the deck into Supabase
   (`decks`, `cards`, `quiz_questions`), scoped to the signed-in user via RLS,
   then redirects to the review page.
3. **Review** (`/deck/[id]/review`) — shows only cards due today. Answering
   Wrong/Hard/Easy recalculates each card's SM-2 state (interval, ease factor,
   repetitions, next review date) and updates it optimistically in the UI while
   saving to Supabase in the background.
4. **Quiz** (`/deck/[id]/quiz`) — multiple-choice questions with instant
   right/wrong feedback and an explanation; the final score is saved to
   `quiz_attempts`.
5. **My Decks** (`/decks`) — lists every saved deck with its due-card count and
   last quiz score, with links to review/quiz, an Anki export button, and delete.

## Known gaps / next steps

- No password reset flow (Supabase Auth supports it — just needs a page)
- No collaborative/shared decks — everything is private per user
- Export is Anki-only; no PDF/CSV export yet
