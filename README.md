# Recall.ai — AI Flashcard & Quiz Generator

> Transform raw text, web URLs, PDFs, and Word documents into AI-generated spaced repetition flashcards, interactive quizzes, and study analytics.

[![Next.js](https://img.shields.io/badge/Next.js-14.2.5-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38bdf8?logo=tailwindcss)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-Database%20%26%20Auth-3ecf8e?logo=supabase)](https://supabase.com/)
[![Groq](https://img.shields.io/badge/AI-Groq%20Llama%203.3%2070B-orange)](https://groq.com/)

---

## 🌟 Key Features

### 🧠 1. Multi-Input AI Deck Generation
- **Multi-Format Extraction**: Paste raw text, enter a webpage URL (scraped via `cheerio`), or upload PDF / DOCX documents (parsed via `pdf-parse` and `mammoth`).
- **Smart Chunking & Merging**: Automatically chunks large documents to bypass LLM context limits and merges deduplicated JSON output seamlessly.
- **Difficulty Modes**: Choose between **Basic Recall** (key definitions & terms) and **Applied & Conceptual** (problem-solving & reasoning).
- **Interactive Selective Preview**: Preview generated cards & quiz questions with toggle checkboxes to save only what you need.

### 🎴 2. Spaced Repetition Flashcards (SM-2)
- **Standard SM-2 Algorithm**: Dynamically calculates repetition interval, ease factor, and due dates based on user review performance (Wrong / Hard / Easy).
- **3D Flip Animation**: Smooth CSS 3D card flips with Framer Motion transitions.
- **Keyboard Shortcuts**:
  - `Space` — Flip card
  - `1` — Grade as Wrong
  - `2` — Grade as Hard
  - `3` — Grade as Easy

### 🤖 3. Recall Copilot (AI Study Assistant)
- **Slide-Over AI Chat**: Open an in-context AI study assistant during flashcard review.
- **Streaming Responses**: Real-time streaming answers powered by Llama 3.3 70B on Groq.
- **Context-Aware**: Asks for simplified explanations (ELI5), mnemonics, analogies, or real-world examples specifically for the active card.

### 🎤 4. Speech-to-Text & Voice Answer Matching
- **Hands-Free Speech Mode**: Speak your answer directly into the microphone via the Web Speech API (`window.SpeechRecognition`).
- **Intelligent Match Score**: Algorithmic word-matching calculates exact accuracy percentages comparing spoken transcripts against correct card answers, providing instant grade suggestions.

### 🔊 5. Text-to-Speech & Real-Time Card Translation
- **Multi-Voice TTS**: Listen to flashcard questions and answers with custom accent selection and adjustable speed rate (0.5x to 2.0x).
- **Instant Translation**: Translate card content on-the-fly into 7 major languages (*Spanish, French, German, Chinese, Arabic, Hindi, Urdu*).

### 🎯 6. Interactive Quizzes
- **Multiple-Choice Assessment**: 4-option quizzes generated alongside flashcards.
- **Instant Explanations**: Immediate visual feedback with explanatory context for each option.
- **Keyboard Navigation**: Select options `A`, `B`, `C`, `D` and press `Enter` to submit.
- **Historical Score Persistence**: Tracks score percentages saved directly to Supabase (`quiz_attempts`).

### 📊 7. Visual Study Analytics Dashboard
- **Retention & Mastery Rings**: SVG Apple Activity-style rings categorizing cards into *Mastered (Interval ≥ 7d)*, *Reviewing*, and *New*.
- **Quiz Score Trends**: Dynamic SVG linear score graph showing performance trends across your last 10 quiz attempts.
- **Daily Study Streak Counter**: Automatically records active days to keep your study momentum going.

### 🌐 8. Community Deck Sharing & Discovery
- **Public Deck Library**: Browse decks shared by students worldwide on the **Discover** page.
- **Card Previewer**: Preview the first 5 cards before importing.
- **1-Click Deck Import**: Clone public decks into your personal workspace with flashcards and quiz questions intact.

### 📂 9. Deck Management & CSV/TSV Integration
- **CSV / TSV Import**: Paste card data directly from spreadsheet exports or Anki text formats.
- **Deck Merging**: Combine multiple decks into a single consolidated master deck.
- **Anki Export**: Export any deck into a tab-separated `.txt` file ready for Anki import.
- **Granular Deck Editor**: Edit deck titles, card fronts/backs, quiz options, correct answers, explanations, or toggle public visibility.

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 14](https://nextjs.org/) (App Router, Server Actions & API Routes)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) (with persistent dark mode)
- **Animations**: [Framer Motion](https://www.framer.com/motion/)
- **Database & Auth**: [Supabase](https://supabase.com/) (PostgreSQL, Row Level Security, Email/Password Auth)
- **AI Engine**: Pluggable architecture using [Groq SDK](https://github.com/groq/groq-typescript) (`llama-3.3-70b-versatile`)
- **Document Extractors**: `cheerio` (Web Scraping), `pdf-parse` (PDF), `mammoth` (DOCX)

---

## 📁 Directory Structure

```
├── app/
│   ├── analytics/               # Study statistics, mastery rings & quiz score graphs
│   ├── api/
│   │   ├── copilot/             # LLM streaming endpoint for Recall Copilot
│   │   ├── generate/            # File/URL text extraction + AI card chunking
│   │   ├── save-deck/           # Deck & quiz persistence endpoint
│   │   └── translate/           # Multi-language card translation endpoint
│   ├── deck/
│   │   └── [id]/
│   │       ├── edit/            # Deck & quiz question editor + public toggle
│   │       ├── quiz/            # Interactive quiz mode with keyboard shortcuts
│   │       └── review/          # SM-2 review page, TTS, speech recognition & Copilot
│   ├── decks/                   # My Decks dashboard, CSV import, deck merging & Anki export
│   ├── discover/                # Community library & public deck importer
│   ├── globals.css              # Custom CSS variables, fonts & 3D card flip utilities
│   ├── layout.tsx               # Root layout, Navbar & dark-mode initializer
│   └── page.tsx                 # Main AI generator page with interactive preview
│
├── components/
│   ├── AuthForm.tsx             # Supabase email/password login & registration
│   ├── CopilotDrawer.tsx        # Slide-over AI Copilot chat drawer
│   ├── FlipCard.tsx             # 3D interactive flashcard with TTS & translation
│   ├── Navbar.tsx               # Header navigation with authentication state
│   ├── StatusIndicator.tsx      # Live multi-step generation progress UI
│   └── ThemeToggle.tsx          # Light/Dark mode switcher
│
├── lib/
│   ├── ankiExport.ts            # Export deck to Anki TSV file format
│   ├── chunkAndGenerate.ts      # Text chunking, AI prompt engineering & JSON parsing
│   ├── extract.ts              # Extraction pipeline for web URLs, PDFs, and DOCX files
│   ├── import.ts               # TSV/CSV raw text parser
│   ├── sm2.ts                  # SuperMemo SM-2 algorithm math & state calculator
│   ├── supabaseClient.ts        # Supabase browser client initializers
│   └── voiceMatch.ts           # Speech normalization & accuracy match scorer
│
└── supabase/
    └── schema.sql               # Complete SQL schema (decks, cards, quiz_questions, attempts, sessions, RLS)
```

---

## 🚀 Getting Started

### 1. Prerequisites
- [Node.js](https://nodejs.org/) v18+ 
- [npm](https://www.npmjs.com/) or `pnpm`
- A [Supabase](https://supabase.com/) account
- A [Groq API Key](https://console.groq.com/) (or Anthropic/OpenAI API Key)

### 2. Installation

Clone the repository and install dependencies:
```bash
git clone https://github.com/MuhammadHassaan06/flashcard-quiz-generator.git
cd flashcard-quiz-generator
npm install
```

### 3. Database Setup (Supabase)

1. Create a new Supabase Project.
2. Navigate to **SQL Editor** in your Supabase dashboard and run the entire script in [`supabase/schema.sql`](./supabase/schema.sql).
3. Under **Authentication → Providers → Email**, turn off *Confirm email* for easy local testing.

### 4. Environment Configuration

Create a `.env.local` file in the root directory and set the required variables:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# AI Provider API Keys
GROQ_API_KEY=your-groq-api-key
```

### 5. Running the Application

Start the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 💻 Git Commands for Uncommitted Changes

To commit all recent updates and newly modified files (including `README.md` and modified components/pages), run the following commands in your terminal:

```bash
# 1. Check the status of modified and untracked files
git status

# 2. Stage all changes
git add .

# 3. Commit with a descriptive message
git commit -m "docs: update README with full project review, features, tech stack, and setup instructions"

# 4. Push to remote repository
git push origin main
```

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
