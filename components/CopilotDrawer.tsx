"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface CopilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cardFront: string;
  cardBack: string;
}

export default function CopilotDrawer({ isOpen, onClose, cardFront, cardBack }: CopilotDrawerProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Clear messages when card changes
  useEffect(() => {
    setMessages([]);
  }, [cardFront, cardBack]);

  // Scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);

    try {
      const response = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: userMessage,
          cardFront,
          cardBack,
          history: messages,
        }),
      });

      if (!response.body) throw new Error("No response stream.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantResponse = "";

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        assistantResponse += decoder.decode(value);
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: "assistant", content: assistantResponse };
          return copy;
        });
      }
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, I couldn't reach the AI. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black z-50 cursor-pointer"
          />

          {/* Drawer content */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-full sm:w-[420px] bg-paper dark:bg-ink border-l border-ink/10 dark:border-paper/10 shadow-2xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="p-4 border-b border-ink/10 dark:border-paper/10 flex items-center justify-between bg-white dark:bg-white/5">
              <div className="flex items-center gap-2">
                <span className="h-6 w-6 rounded-lg bg-accent flex items-center justify-center text-white text-[10px] font-bold">
                  🤖
                </span>
                <div>
                  <h3 className="text-xs font-bold text-ink dark:text-paper uppercase tracking-wider">Recall Copilot</h3>
                  <p className="text-[10px] text-muted">Contextual Study Assistant</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-ink/5 dark:hover:bg-paper/5 text-muted transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Context Widget */}
            <div className="p-3 bg-accent/5 border-b border-ink/10 dark:border-paper/10 text-[10px]">
              <span className="font-bold text-accent uppercase tracking-wider block mb-1">Active Context</span>
              <p className="text-muted leading-relaxed font-semibold">Q: {cardFront.slice(0, 80)}{cardFront.length > 80 ? "..." : ""}</p>
              <p className="text-muted leading-relaxed italic mt-0.5">A: {cardBack.slice(0, 80)}{cardBack.length > 80 ? "..." : ""}</p>
            </div>

            {/* Chat list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && (
                <div className="text-center py-12 px-6">
                  <span className="text-2xl mb-2 block">💡</span>
                  <h4 className="text-xs font-bold mb-1">Ask me anything!</h4>
                  <p className="text-[10px] text-muted leading-relaxed">
                    Struggling to memorize this card? Ask me to explain it like you're five, give you a real-world example, or make a mnemonic helper!
                  </p>
                </div>
              )}

              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3 py-2.5 text-xs leading-relaxed ${
                      msg.role === "user"
                        ? "bg-accent text-white rounded-tr-none shadow-md shadow-accent/10"
                        : "bg-white dark:bg-white/5 border border-ink/10 dark:border-paper/10 text-ink dark:text-paper rounded-tl-none shadow-sm"
                    }`}
                  >
                    {msg.content || (
                      <div className="flex items-center gap-1 py-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-muted animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="h-1.5 w-1.5 rounded-full bg-muted animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="h-1.5 w-1.5 rounded-full bg-muted animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Input Form */}
            <form
              onSubmit={handleSend}
              className="p-3 border-t border-ink/10 dark:border-paper/10 bg-white dark:bg-white/5 flex gap-2"
            >
              <input
                type="text"
                placeholder="Ask for an analogy, mnemonic..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={loading}
                className="flex-1 px-3 py-2 text-xs rounded-xl border border-ink/10 dark:border-paper/10 bg-paper/30 dark:bg-ink/30 focus:outline-none focus:border-accent transition-colors disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="bg-accent text-white p-2 rounded-xl hover:opacity-95 disabled:opacity-50 transition-opacity flex items-center justify-center"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
