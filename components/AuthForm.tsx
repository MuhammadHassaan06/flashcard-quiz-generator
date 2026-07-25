"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabaseClient";

export default function AuthForm({ onAuthed }: { onAuthed: () => void }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({ email, password });
      setLoading(false);
      if (error) {
        setError(error.message);
        return;
      }
      await supabase.auth.signOut();
      setMode("signin");
      setPassword("");
      setInfo("Account created. Sign in below to continue.");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    onAuthed();
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="flex flex-col items-center justify-center min-h-[calc(100vh-80px)] px-4 py-4 overflow-hidden"
    >
      <div className="w-full max-w-md bg-white dark:bg-white/5 border border-ink/10 dark:border-paper/10 rounded-3xl p-6 sm:p-8 shadow-sm text-center">
        {/* Logo Icon */}
        <div className="h-12 w-12 rounded-2xl bg-accent flex items-center justify-center text-white font-display font-bold text-xl shadow-md shadow-accent/25 mx-auto mb-6">
          R
        </div>

        <h1 className="font-display text-2xl font-bold mb-1 text-ink dark:text-paper">
          {mode === "signin" ? "Sign In to Recall.ai" : "Create your Account"}
        </h1>
        <p className="text-xs text-muted mb-8 leading-relaxed">
          Create an account or sign in to save your AI-generated decks, track quiz attempts, and practice spaced repetition.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          {info && (
            <p className="text-xs text-accent bg-accent/10 px-3.5 py-2 rounded-xl font-bold text-center">
              {info}
            </p>
          )}

          <div>
            <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5 ml-1">
              Email Address
            </label>
            <input
              type="email"
              required
              placeholder="e.g. user@domain.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-ink/10 dark:border-paper/10 bg-paper/30 dark:bg-ink/30 text-sm focus:outline-none focus:border-accent transition-colors"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5 ml-1">
              Password
            </label>
            <input
              type="password"
              required
              minLength={6}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-ink/10 dark:border-paper/10 bg-paper/30 dark:bg-ink/30 text-sm focus:outline-none focus:border-accent transition-colors"
            />
          </div>

          {error && (
            <p className="text-xs text-accent2 bg-accent2/10 px-3.5 py-2 rounded-xl font-bold text-center">
              {error}
            </p>
          )}

          <motion.button
            type="submit"
            disabled={loading}
            whileTap={{ scale: 0.97 }}
            className="w-full bg-accent text-white py-3.5 rounded-xl font-bold text-xs tracking-wide shadow-md shadow-accent/15 hover:opacity-95 transition-all disabled:opacity-50 mt-2 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="h-3.5 w-3.5 rounded-full border border-white border-t-transparent animate-spin" />
                Please wait...
              </>
            ) : mode === "signin" ? (
              "Sign In"
            ) : (
              "Create Account"
            )}
          </motion.button>
        </form>

        <div className="mt-6 pt-6 border-t border-ink/5 dark:border-paper/5 text-center">
          <button
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setInfo(null);
              setError(null);
            }}
            className="text-xs text-muted hover:text-accent font-semibold transition-colors underline"
          >
            {mode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}
          </button>
        </div>
      </div>

      <p className="text-[10px] text-muted/60 mt-6 text-center leading-relaxed max-w-xs mx-auto">
        Note: If your Supabase configuration requires email verification, check your inbox after signing up before logging in.
      </p>
    </motion.div>
  );
}