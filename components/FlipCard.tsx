"use client";

import { motion } from "framer-motion";

export default function FlipCard({
  front,
  back,
  flipped,
}: {
  front: string;
  back: string;
  flipped: boolean;
}) {
  const speak = (text: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card from flipping
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <motion.div
      className="flip-scene w-full h-72"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
      <div className={`flip-card ${flipped ? "flipped" : ""}`}>
        {/* Front Face */}
        <div className="flip-face bg-white dark:bg-white/5 border border-ink/10 dark:border-paper/10 rounded-2xl shadow-sm flex items-center justify-center p-8 text-center relative">
          <button
            onClick={(e) => speak(front, e)}
            className="absolute top-4 right-4 p-2 rounded-xl hover:bg-ink/5 dark:hover:bg-paper/5 text-muted hover:text-accent transition-colors z-10"
            title="Listen"
            aria-label="Listen to front text"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
              />
            </svg>
          </button>
          <p className="font-display text-lg leading-relaxed">{front}</p>
        </div>

        {/* Back Face */}
        <div className="flip-face flip-face-back bg-ink dark:bg-paper text-paper dark:text-ink rounded-2xl shadow-sm flex items-center justify-center p-8 text-center relative">
          <button
            onClick={(e) => speak(back, e)}
            className="absolute top-4 right-4 p-2 rounded-xl hover:bg-paper/10 dark:hover:bg-ink/5 text-paper/70 dark:text-ink/75 hover:text-accent dark:hover:text-accent transition-colors z-10"
            title="Listen"
            aria-label="Listen to back text"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
              />
            </svg>
          </button>
          <p className="font-body text-base leading-relaxed">{back}</p>
        </div>
      </div>
    </motion.div>
  );
}