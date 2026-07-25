"use client";

import { motion } from "framer-motion";

const STAGE_LABELS: Record<string, string> = {
  parsing: "Parsing Document",
  chunking: "Splitting Into Chunks",
  generating: "Running Chunk Analysis",
  merging: "Merging Results",
  done: "Done",
};

const ORDER = ["parsing", "chunking", "generating", "merging", "done"];

export default function StatusIndicator({
  stage,
  detail,
}: {
  stage: string;
  detail?: string;
}) {
  const currentIndex = ORDER.indexOf(stage);

  return (
    <div className="w-full max-w-md mx-auto py-8" role="status" aria-live="polite">
      <ul className="space-y-3">
        {ORDER.map((s, i) => {
          const isActive = i === currentIndex;
          const isComplete = i < currentIndex;
          return (
            <motion.li
              key={s}
              className="flex items-center gap-3"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <motion.span
                className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${
                  isComplete ? "bg-accent" : isActive ? "bg-accent2" : "bg-muted/30"
                }`}
                animate={isActive ? { scale: [1, 1.3, 1] } : { scale: 1 }}
                transition={isActive ? { repeat: Infinity, duration: 1.1 } : {}}
              />
              <span
                className={`text-sm ${
                  isActive
                    ? "text-ink dark:text-paper font-medium"
                    : isComplete
                    ? "text-muted"
                    : "text-muted/50"
                }`}
              >
                {STAGE_LABELS[s]}
                {isActive && detail ? (
                  <span className="text-muted font-normal"> — {detail}</span>
                ) : null}
              </span>
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}