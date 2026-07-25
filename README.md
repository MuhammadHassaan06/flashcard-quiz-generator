# AI Flashcard & Quiz Generator

## What's included
- `app/page.tsx` — input page (text / URL / file), streams generation progress
- `app/api/generate/route.ts` — generation API route (chunking, extraction, Claude call)
- `app/deck/[id]/review/page.tsx` — flashcard review (3D flip, keyboard, SM-2)
- `app/deck/[id]/quiz/page.tsx` — quiz mode (keyboard bindings, scoring)
- `lib/` — extraction, chunking/generation, SM-2 algorithm, Supabase clients
- `supabase/schema.sql` — full DB schema with RLS policies

## Not included (left as next steps)
- Auth screens (Supabase Auth UI or your own login form)
- The "save generated result to Supabase" step after generation on the home page
  (there's a comment marking exactly where that API call goes)
- Anki export utility

---

## How to run this in VS Code

### 1. Install Node.js
You need Node.js 18.17+ installed. Check with:
```
node -v
```
If you don't have it, download from nodejs.org.

### 2. Open the project
Open the `flashcard-quiz-generator` folder in VS Code (`File > Open Folder`).

### 3. Install dependencies
Open a terminal in VS Code (`` Ctrl+` ``) and run:
```
npm install
```

### 4. Set up Supabase
1. Create a free project at supabase.com.
2. Go to the SQL Editor in your Supabase dashboard, paste the contents of
   `supabase/schema.sql`, and run it — this creates all tables and security policies.
3. Go to Project Settings → API and copy your Project URL, anon key, and service role key.

### 5. Set up environment variables
Copy the example env file:
```
cp .env.local.example .env.local
```
Open `.env.local` and fill in:
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` — from Supabase
- `ANTHROPIC_API_KEY` — from console.anthropic.com → API Keys

### 6. Run the dev server
```
npm run dev
```
Open http://localhost:3000 in your browser.

### 7. Try it
On the home page, paste some text and click Generate — you'll see the multi-step
status indicator run through parsing → chunking → generating → merging, then the
raw generated JSON at the bottom. Wiring that result into a saved deck (so
`/deck/[id]/review` and `/deck/[id]/quiz` have real data) is the next step —
see the comment in `app/page.tsx`.

### Deploying
When you're ready to deploy: push this to GitHub, then import it on vercel.com.
Add the same environment variables in the Vercel project settings before deploying.
