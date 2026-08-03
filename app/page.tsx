"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import type { Session } from "@supabase/supabase-js";
import StatusIndicator from "@/components/StatusIndicator";
import AuthForm from "@/components/AuthForm";
import { supabase } from "@/lib/supabaseClient";
import type { GenerationResult } from "@/lib/chunkAndGenerate";

type InputMode = "text" | "url" | "file" | "image";

function formatBytes(bytes: number) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function compressImageToBase64(file: File, maxWidth = 1200, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve(dataUrl);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
}

export default function HomePage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const [mode, setMode] = useState<InputMode>("text");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [difficulty, setDifficulty] = useState<"basic" | "applied">("basic");

  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [stage, setStage] = useState("parsing");
  const [detail, setDetail] = useState<string | undefined>();
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Preview selection states
  const [selectedCards, setSelectedCards] = useState<boolean[]>([]);
  const [selectedQuizzes, setSelectedQuizzes] = useState<boolean[]>([]);
  const [previewTab, setPreviewTab] = useState<"flashcards" | "quiz">("flashcards");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setCheckingAuth(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => listener.subscription.unsubscribe();
  }, []);

  // Sync selection checkboxes when a new generation result is received
  useEffect(() => {
    if (result) {
      setSelectedCards(new Array(result.flashcards.length).fill(true));
      setSelectedQuizzes(new Array(result.quiz.length).fill(true));
    }
  }, [result]);

  async function handleGenerate() {
    if (mode === "text" && !text.trim()) {
      setError("Please enter some text notes to generate cards.");
      return;
    }
    if (mode === "url" && !url.trim()) {
      setError("Please provide a valid URL.");
      return;
    }
    if (mode === "file" && !file) {
      setError("Please select a PDF, TXT, or Word document file.");
      return;
    }
    if (mode === "image" && !imageFile) {
      setError("Please select an image photo of your textbook, slides, or notes.");
      return;
    }

    setError(null);
    setResult(null);
    setIsGenerating(true);
    setStage("parsing");

    // Special client-side compressed handler for Image OCR
    if (mode === "image" && imageFile) {
      setDetail("Compressing and extracting text from image via AI Vision...");
      try {
        const base64Data = await compressImageToBase64(imageFile);
        const res = await fetch("/api/ocr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: base64Data, cardCount: 6 }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "OCR Image analysis failed.");

        setResult({
          flashcards: data.flashcards || [],
          quiz: [],
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to analyze image.");
      } finally {
        setIsGenerating(false);
      }
      return;
    }

    const formData = new FormData();
    formData.append("inputType", mode);
    formData.append("difficulty", difficulty);
    if (mode === "text") formData.append("text", text);
    if (mode === "url") formData.append("url", url);
    if (mode === "file" && file) formData.append("file", file);

    try {
      const res = await fetch("/api/generate", { method: "POST", body: formData });
      if (!res.body) throw new Error("No response stream.");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line);
          if (event.error) {
            setError(event.error);
          } else if (event.stage === "done" && event.result) {
            setResult(event.result);
          } else {
            setStage(event.stage);
            setDetail(event.detail);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleSaveAndReview() {
    if (!result || !session) return;
    setError(null);

    const finalFlashcards = result.flashcards.filter((_, idx) => selectedCards[idx]);
    const finalQuiz = result.quiz.filter((_, idx) => selectedQuizzes[idx]);

    if (finalFlashcards.length === 0 && finalQuiz.length === 0) {
      setError("Please select at least one card or quiz question to save.");
      return;
    }

    setIsSaving(true);

    let cleanTitle = title.trim();
    if (!cleanTitle) {
      if (mode === "url") {
        try {
          const u = new URL(url);
          cleanTitle = `${u.hostname}${u.pathname.length > 1 ? u.pathname.slice(0, 12) : ""}`;
        } catch {
          cleanTitle = "Web Article Deck";
        }
      } else if (mode === "file" && file) {
        cleanTitle = file.name.replace(/\.[^/.]+$/, "");
      } else {
        cleanTitle = "Notes Deck";
      }
    }

    try {
      const res = await fetch("/api/save-deck", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          title: cleanTitle,
          sourceType: mode,
          difficulty,
          flashcards: finalFlashcards,
          quiz: finalQuiz,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save deck.");
      router.push(`/deck/${data.deckId}/review`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save deck.");
    } finally {
      setIsSaving(false);
    }
  }

  const toggleCard = (index: number) => {
    setSelectedCards((prev) => {
      const copy = [...prev];
      copy[index] = !copy[index];
      return copy;
    });
  };

  const toggleQuiz = (index: number) => {
    setSelectedQuizzes((prev) => {
      const copy = [...prev];
      copy[index] = !copy[index];
      return copy;
    });
  };

  if (checkingAuth) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="h-6 w-6 rounded-full border-2 border-accent border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!session) {
    return <AuthForm onAuthed={() => {}} />;
  }

  return (
    <motion.main
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="max-w-3xl mx-auto px-6 py-12"
    >
      {/* Hero Section */}
      <div className="text-center mb-10">
        <h1 className="font-display text-4xl font-extrabold mb-3 tracking-tight bg-gradient-to-r from-ink to-ink/75 dark:from-paper dark:to-paper/75 bg-clip-text text-transparent">
          AI Flashcard & Quiz Generator
        </h1>
        <p className="text-muted text-sm max-w-lg mx-auto leading-relaxed">
          Transform any notes, article links, or PDF documents into structured spaced-repetition flashcards and multiple-choice quizzes in seconds.
        </p>
      </div>

      {/* Input Form Panel */}
      <div className="bg-white dark:bg-white/5 border border-ink/10 dark:border-paper/10 rounded-3xl p-6 shadow-sm mb-8">
        <div className="flex gap-2 mb-6">
          {(["text", "url", "file", "image"] as InputMode[]).map((m) => (
            <motion.button
              key={m}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setMode(m);
                setError(null);
              }}
              className={`px-4 py-2 rounded-full text-xs font-semibold border transition-all ${
                mode === m
                  ? "bg-ink dark:bg-paper text-paper dark:text-ink border-ink dark:border-paper shadow-sm"
                  : "border-ink/10 dark:border-paper/10 text-muted hover:bg-ink/5 dark:hover:bg-paper/5"
              }`}
            >
              {m === "text"
                ? "Paste Notes"
                : m === "url"
                ? "URL Webpage"
                : m === "file"
                ? "Upload Document"
                : "📷 Image OCR"}
            </motion.button>
          ))}
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">Deck Title (Optional)</label>
            <input
              className="w-full px-4 py-3 rounded-xl border border-ink/10 dark:border-paper/10 bg-paper/30 dark:bg-ink/30 text-sm focus:outline-none focus:border-accent transition-colors"
              placeholder="e.g. History Chapter 4, React Hooks Advanced..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <AnimatePresence mode="wait">
            {mode === "text" && (
              <motion.div
                key="text"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.2 }}
              >
                <label className="block text-xs font-medium text-muted mb-1.5">Paste Text Content</label>
                <textarea
                  className="w-full h-48 p-4 rounded-xl border border-ink/10 dark:border-paper/10 bg-paper/30 dark:bg-ink/30 text-sm focus:outline-none focus:border-accent transition-colors font-sans leading-relaxed"
                  placeholder="Paste study material, article body, or general study notes (minimum 20 characters)..."
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
              </motion.div>
            )}

            {mode === "url" && (
              <motion.div
                key="url"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.2 }}
              >
                <label className="block text-xs font-medium text-muted mb-1.5">Source URL</label>
                <input
                  className="w-full px-4 py-3 rounded-xl border border-ink/10 dark:border-paper/10 bg-paper/30 dark:bg-ink/30 text-sm focus:outline-none focus:border-accent transition-colors"
                  placeholder="https://en.wikipedia.org/wiki/Spaced_repetition"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
              </motion.div>
            )}

            {mode === "file" && (
              <motion.div
                key="file"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.2 }}
              >
                <label className="block text-xs font-medium text-muted mb-1.5">
                  Select Document (PDF, TXT, MD, DOCX)
                </label>
                {file ? (
                  <div className="p-4 rounded-xl border border-accent/30 bg-accent/5 flex items-center justify-between">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <span className="text-xl">📄</span>
                      <div className="truncate">
                        <p className="text-xs font-bold text-ink dark:text-paper truncate">{file.name}</p>
                        <span className="text-[10px] text-accent font-mono font-semibold">{formatBytes(file.size)}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => setFile(null)}
                      className="text-xs font-bold text-accent2 hover:bg-accent2/10 px-2.5 py-1 rounded-lg transition-colors shrink-0"
                    >
                      ✕ Remove
                    </button>
                  </div>
                ) : (
                  <input
                    type="file"
                    accept=".pdf,.docx,.txt,.md,.PDF,.DOCX,.TXT,.MD"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    className="w-full p-4 rounded-xl border border-dashed border-ink/20 dark:border-paper/20 bg-paper/30 dark:bg-ink/30 text-sm file:mr-4 file:py-1.5 file:px-3.5 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-accent/15 file:text-accent hover:file:bg-accent/20 transition-all cursor-pointer"
                  />
                )}
              </motion.div>
            )}

            {mode === "image" && (
              <motion.div
                key="image"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.2 }}
              >
                <label className="block text-xs font-medium text-muted mb-1.5">
                  Select Textbook Photo, Slides, or Handwritten Notes
                </label>
                {imageFile ? (
                  <div className="p-4 rounded-xl border border-accent/30 bg-accent/5 flex items-center justify-between">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <span className="text-xl">🖼️</span>
                      <div className="truncate">
                        <p className="text-xs font-bold text-ink dark:text-paper truncate">{imageFile.name}</p>
                        <span className="text-[10px] text-accent font-mono font-semibold">{formatBytes(imageFile.size)}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => setImageFile(null)}
                      className="text-xs font-bold text-accent2 hover:bg-accent2/10 px-2.5 py-1 rounded-lg transition-colors shrink-0"
                    >
                      ✕ Remove
                    </button>
                  </div>
                ) : (
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
                    className="w-full p-4 rounded-xl border border-dashed border-accent/40 bg-accent/5 text-sm file:mr-4 file:py-1.5 file:px-3.5 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-accent file:text-white hover:file:opacity-90 transition-all cursor-pointer"
                  />
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center justify-between pt-4 border-t border-ink/5 dark:border-paper/5">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-muted">Difficulty Level:</label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as "basic" | "applied")}
                className="border border-ink/10 dark:border-paper/10 rounded-xl px-3 py-1.5 bg-paper/50 dark:bg-ink/50 text-xs font-semibold text-ink dark:text-paper focus:outline-none focus:border-accent cursor-pointer"
              >
                <option value="basic">Basic Recall</option>
                <option value="applied">Applied & Conceptual</option>
              </select>
            </div>

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleGenerate}
              disabled={isGenerating}
              className="bg-accent text-white px-6 py-2.5 rounded-xl font-semibold text-xs tracking-wide shadow-lg shadow-accent/20 hover:opacity-95 disabled:opacity-50 transition-all flex items-center gap-2"
            >
              {isGenerating ? (
                <>
                  <span className="h-3.5 w-3.5 rounded-full border border-white border-t-transparent animate-spin" />
                  Generating...
                </>
              ) : (
                "Generate Deck"
              )}
            </motion.button>
          </div>
        </div>
      </div>

      {/* Progress & Error States */}
      {isGenerating && (
        <div className="bg-white dark:bg-white/5 border border-ink/10 dark:border-paper/10 rounded-3xl p-6 shadow-sm mb-8">
          <StatusIndicator stage={stage} detail={detail} />
        </div>
      )}

      {error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="p-4 mb-8 bg-accent2/10 border border-accent2/20 text-accent2 rounded-2xl text-xs font-semibold flex items-center gap-3"
        >
          <span className="h-2 w-2 rounded-full bg-accent2 flex-shrink-0 animate-ping" />
          {error}
        </motion.div>
      )}

      {/* Interactive Preview Panel */}
      {result && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-white/5 border border-ink/10 dark:border-paper/10 rounded-3xl p-6 shadow-sm"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-ink/5 dark:border-paper/5">
            <div>
              <h2 className="font-display text-xl font-bold">Review Generated Deck</h2>
              <p className="text-xs text-muted mt-1">
                Select which cards and quiz questions you want to save.
              </p>
            </div>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleSaveAndReview}
              disabled={isSaving}
              className="bg-ink dark:bg-paper text-paper dark:text-ink px-6 py-3 rounded-2xl font-semibold text-xs tracking-wide shadow-md disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <>
                  <span className="h-3.5 w-3.5 rounded-full border border-current border-t-transparent animate-spin" />
                  Saving...
                </>
              ) : (
                `Save Deck (${selectedCards.filter(Boolean).length} Cards, ${selectedQuizzes.filter(Boolean).length} Quizzes)`
              )}
            </motion.button>
          </div>

          {/* Preview Tabs */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setPreviewTab("flashcards")}
              className={`flex-1 py-2 text-center rounded-xl text-xs font-bold transition-all border ${
                previewTab === "flashcards"
                  ? "bg-accent/15 border-accent/20 text-accent"
                  : "border-transparent text-muted hover:bg-ink/5 dark:hover:bg-paper/5"
              }`}
            >
              Flashcards ({selectedCards.filter(Boolean).length}/{result.flashcards.length})
            </button>
            <button
              onClick={() => setPreviewTab("quiz")}
              className={`flex-1 py-2 text-center rounded-xl text-xs font-bold transition-all border ${
                previewTab === "quiz"
                  ? "bg-accent/15 border-accent/20 text-accent"
                  : "border-transparent text-muted hover:bg-ink/5 dark:hover:bg-paper/5"
              }`}
            >
              Quiz Questions ({selectedQuizzes.filter(Boolean).length}/{result.quiz.length})
            </button>
          </div>

          {/* Tab Contents */}
          <AnimatePresence mode="wait">
            {previewTab === "flashcards" ? (
              <motion.div
                key="flashcards-preview"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-3 max-h-[450px] overflow-y-auto pr-2"
              >
                {result.flashcards.map((card, idx) => (
                  <div
                    key={idx}
                    onClick={() => toggleCard(idx)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start gap-4 ${
                      selectedCards[idx]
                        ? "bg-accent/5 border-accent/35"
                        : "bg-paper/20 border-ink/10 dark:border-paper/10 opacity-60 hover:opacity-85"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedCards[idx] || false}
                      onChange={() => {}} // handled by div onClick
                      className="mt-1 h-4 w-4 rounded border-ink/20 dark:border-paper/20 text-accent focus:ring-accent"
                    />
                    <div className="flex-1 space-y-1">
                      <div className="text-xs font-bold text-ink dark:text-paper">Front (Question):</div>
                      <div className="text-xs text-muted font-medium leading-relaxed">{card.front}</div>
                      <div className="text-xs font-bold text-ink dark:text-paper pt-1.5">Back (Answer):</div>
                      <div className="text-xs text-muted font-medium leading-relaxed whitespace-pre-wrap">{card.back}</div>
                    </div>
                  </div>
                ))}
              </motion.div>
            ) : (
              <motion.div
                key="quiz-preview"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4 max-h-[450px] overflow-y-auto pr-2"
              >
                {result.quiz.map((q, idx) => (
                  <div
                    key={idx}
                    onClick={() => toggleQuiz(idx)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start gap-4 ${
                      selectedQuizzes[idx]
                        ? "bg-accent/5 border-accent/35"
                        : "bg-paper/20 border-ink/10 dark:border-paper/10 opacity-60 hover:opacity-85"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedQuizzes[idx] || false}
                      onChange={() => {}} // handled by div onClick
                      className="mt-1 h-4 w-4 rounded border-ink/20 dark:border-paper/20 text-accent focus:ring-accent"
                    />
                    <div className="flex-1 space-y-2">
                      <div className="text-xs font-bold leading-relaxed text-ink dark:text-paper">
                        Q{idx + 1}: {q.question}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-2">
                        {q.options.map((opt, optIdx) => (
                          <div
                            key={optIdx}
                            className={`px-3 py-1.5 rounded-lg border text-xs font-medium leading-normal ${
                              optIdx === q.correct_index
                                ? "bg-accent/15 border-accent/30 text-accent font-semibold"
                                : "bg-paper/40 border-ink/5 dark:border-paper/5 text-muted"
                            }`}
                          >
                            <span className="text-muted mr-1">
                              {["A", "B", "C", "D"][optIdx]}.
                            </span>
                            {opt}
                          </div>
                        ))}
                      </div>
                      <div className="text-[11px] text-muted italic pl-2 pt-1 border-t border-ink/5 dark:border-paper/5">
                        <span className="font-bold text-accent">Explanation:</span> {q.explanation}
                      </div>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </motion.main>
  );
}