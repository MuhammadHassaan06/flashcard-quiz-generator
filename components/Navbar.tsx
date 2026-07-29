"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import type { Session } from "@supabase/supabase-js";
import ThemeToggle from "./ThemeToggle";
import { motion } from "framer-motion";

export default function Navbar() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setLoading(false);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/");
  }

  // Render a minimal navbar with just the logo and theme toggle if not logged in
  if (!session) {
    return (
      <header className="w-full border-b border-ink/5 dark:border-paper/5 bg-paper/85 dark:bg-ink/85 backdrop-blur-md transition-colors duration-300">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <span className="h-8 w-8 rounded-xl bg-accent flex items-center justify-center text-white font-display font-bold text-lg shadow-md shadow-accent/20 group-hover:scale-105 transition-transform">
              R
            </span>
            <span className="font-display font-bold text-xl tracking-tight bg-gradient-to-r from-ink to-ink/70 dark:from-paper dark:to-paper/70 bg-clip-text text-transparent">
              Recall<span className="text-accent font-extrabold font-body">.ai</span>
            </span>
          </Link>
          <ThemeToggle />
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-ink/5 dark:border-paper/5 bg-paper/85 dark:bg-ink/85 backdrop-blur-md transition-colors duration-300">
      <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <span className="h-8 w-8 rounded-xl bg-accent flex items-center justify-center text-white font-display font-bold text-lg shadow-md shadow-accent/20 group-hover:scale-105 transition-transform">
            R
          </span>
          <span className="font-display font-bold text-xl tracking-tight bg-gradient-to-r from-ink to-ink/70 dark:from-paper dark:to-paper/70 bg-clip-text text-transparent">
            Recall<span className="text-accent font-extrabold font-body">.ai</span>
          </span>
        </Link>

        <nav className="flex items-center gap-6">
          <Link
            href="/"
            className={`text-sm font-medium transition-colors hover:text-accent ${
              pathname === "/" ? "text-accent font-semibold" : "text-muted"
            }`}
          >
            Create
          </Link>
          <Link
            href="/decks"
            className={`text-sm font-medium transition-colors hover:text-accent ${
              pathname === "/decks" || (pathname.startsWith("/deck/") && !pathname.endsWith("/edit") && !pathname.endsWith("/review") && !pathname.endsWith("/quiz"))
                ? "text-accent font-semibold"
                : "text-muted"
            }`}
          >
            My Decks
          </Link>
          <Link
            href="/analytics"
            className={`text-sm font-medium transition-colors hover:text-accent ${
              pathname === "/analytics" ? "text-accent font-semibold" : "text-muted"
            }`}
          >
            Stats
          </Link>
          <Link
            href="/discover"
            className={`text-sm font-medium transition-colors hover:text-accent ${
              pathname === "/discover" ? "text-accent font-semibold" : "text-muted"
            }`}
          >
            Discover
          </Link>
          <div className="h-4 w-[1px] bg-ink/10 dark:bg-paper/10" />
          <ThemeToggle />
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleSignOut}
            className="text-xs px-3.5 py-1.5 rounded-full border border-accent2/20 text-accent2 hover:bg-accent2/5 transition-colors font-medium"
          >
            Sign out
          </motion.button>
        </nav>
      </div>
    </header>
  );
}
