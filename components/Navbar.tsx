"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import type { Session } from "@supabase/supabase-js";
import ThemeToggle from "./ThemeToggle";
import { motion, AnimatePresence } from "framer-motion";

export default function Navbar() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
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

  // Click outside to close profile dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close dropdown on route change
  useEffect(() => {
    setIsProfileOpen(false);
  }, [pathname]);

  async function handleSignOut() {
    setIsProfileOpen(false);
    await supabase.auth.signOut();
    router.push("/");
  }

  const userEmail = session?.user?.email || "";
  const userInitial = userEmail ? userEmail[0].toUpperCase() : "U";

  // Render a minimal navbar with just logo and theme toggle if not logged in
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
    <header className="sticky top-0 z-[999] w-full border-b border-ink/5 dark:border-paper/5 bg-paper/90 dark:bg-ink/90 backdrop-blur-md transition-colors duration-300">
      <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <span className="h-8 w-8 rounded-xl bg-accent flex items-center justify-center text-white font-display font-bold text-lg shadow-md shadow-accent/20 group-hover:scale-105 transition-transform">
            R
          </span>
          <span className="font-display font-bold text-xl tracking-tight bg-gradient-to-r from-ink to-ink/70 dark:from-paper dark:to-paper/70 bg-clip-text text-transparent">
            Recall<span className="text-accent font-extrabold font-body">.ai</span>
          </span>
        </Link>

        {/* Main Navigation & Profile */}
        <nav className="flex items-center gap-5">
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

          <div className="h-4 w-[1px] bg-ink/10 dark:bg-paper/10 mx-1" />

          {/* Theme Toggle Button */}
          <ThemeToggle />

          {/* User Profile Avatar & Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <motion.button
              whileTap={{ scale: 0.94 }}
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="flex items-center gap-2 focus:outline-none group"
              title="Account Menu"
              aria-label="User Profile Menu"
            >
              <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-accent to-accent/80 text-white font-bold text-sm flex items-center justify-center shadow-md border-2 border-white dark:border-ink group-hover:ring-2 group-hover:ring-accent/40 transition-all">
                {userInitial}
              </div>
              <svg
                className={`w-3.5 h-3.5 text-muted transition-transform duration-200 ${
                  isProfileOpen ? "rotate-180 text-accent" : "group-hover:text-ink dark:group-hover:text-paper"
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </motion.button>

            {/* Profile Dropdown Popover */}
            <AnimatePresence>
              {isProfileOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.96 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                  className="absolute right-0 top-12 w-64 bg-white dark:bg-zinc-900 border border-ink/15 dark:border-paper/20 rounded-2xl shadow-2xl p-4 z-[9999] text-left ring-1 ring-black/5"
                >
                  {/* User Profile Details */}
                  <div className="flex items-center gap-3 pb-3 mb-3 border-b border-ink/5 dark:border-paper/10">
                    <div className="h-10 w-10 rounded-full bg-accent text-white font-bold text-base flex items-center justify-center shadow-sm shrink-0">
                      {userInitial}
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-xs font-bold text-ink dark:text-paper truncate">
                        {userEmail}
                      </p>
                      <span className="inline-block mt-0.5 text-[9px] font-bold text-accent bg-accent/15 px-2 py-0.5 rounded-full uppercase tracking-wider">
                        Active Learner
                      </span>
                    </div>
                  </div>

                  {/* Navigation Shortcuts */}
                  <div className="space-y-1 mb-3">
                    <Link
                      href="/decks"
                      onClick={() => setIsProfileOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-muted hover:text-ink dark:hover:text-paper hover:bg-ink/5 dark:hover:bg-paper/5 transition-colors"
                    >
                      <span>📂</span> My Decks
                    </Link>
                    <Link
                      href="/analytics"
                      onClick={() => setIsProfileOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-muted hover:text-ink dark:hover:text-paper hover:bg-ink/5 dark:hover:bg-paper/5 transition-colors"
                    >
                      <span>📊</span> Study Analytics
                    </Link>
                    <Link
                      href="/discover"
                      onClick={() => setIsProfileOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-muted hover:text-ink dark:hover:text-paper hover:bg-ink/5 dark:hover:bg-paper/5 transition-colors"
                    >
                      <span>🌐</span> Public Discover
                    </Link>
                  </div>

                  {/* Sign Out Action Button */}
                  <div className="pt-2 border-t border-ink/5 dark:border-paper/10">
                    <button
                      onClick={handleSignOut}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-accent2 bg-accent2/10 hover:bg-accent2/20 transition-colors shadow-sm"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Sign Out
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </nav>
      </div>
    </header>
  );
}
