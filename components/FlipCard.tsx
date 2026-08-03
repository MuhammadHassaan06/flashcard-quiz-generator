"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { parseCloze } from "@/lib/cloze";
import { parseMathAndText } from "@/lib/math";

function FormattedText({ text, isFlipped }: { text: string; isFlipped: boolean }) {
  const clozeSegments = parseCloze(text, isFlipped);

  return (
    <div className="leading-relaxed whitespace-pre-wrap text-left sm:text-center font-body inline-block w-full text-sm sm:text-base space-y-2">
      {clozeSegments.map((seg, idx) => {
        if (seg.isCloze) {
          return (
            <span
              key={idx}
              className={`font-bold px-2 py-0.5 rounded-lg inline-block mx-0.5 transition-all ${
                isFlipped
                  ? "bg-accent/25 text-accent dark:text-accent border border-accent/40"
                  : "bg-accent/15 text-accent border border-accent/30 shadow-sm"
              }`}
            >
              {seg.text}
            </span>
          );
        }

        const mathSegments = parseMathAndText(seg.text);
        return mathSegments.map((mSeg, mIdx) => {
          if (mSeg.type === "inline-math") {
            return (
              <span
                key={`${idx}-${mIdx}`}
                className="inline-block px-1"
                dangerouslySetInnerHTML={{ __html: mSeg.html || mSeg.content }}
              />
            );
          }
          if (mSeg.type === "block-math") {
            return (
              <div
                key={`${idx}-${mIdx}`}
                className="my-2 py-1 overflow-x-auto text-center"
                dangerouslySetInnerHTML={{ __html: mSeg.html || mSeg.content }}
              />
            );
          }
          return (
            <span key={`${idx}-${mIdx}`} className="whitespace-pre-wrap block text-left sm:text-center my-1">
              {mSeg.content}
            </span>
          );
        });
      })}
    </div>
  );
}

export default function FlipCard({
  front,
  back,
  flipped,
}: {
  front: string;
  back: string;
  flipped: boolean;
}) {
  const [targetLang, setTargetLang] = useState("");
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  // Clear translation state when switching flashcards
  useEffect(() => {
    setTargetLang("");
  }, [front, back]);

  // Translate a text string (front or back) to specified language
  const handleTranslate = async (textToTranslate: string, lang: string) => {
    if (!lang) {
      setTargetLang("");
      return;
    }

    setTargetLang(lang);
    const cleanText = typeof textToTranslate === "string" ? textToTranslate : String(textToTranslate || "");
    if (!cleanText.trim()) return;

    const cacheKey = `${cleanText}_${lang}`;
    if (translations[cacheKey]) return;

    setLoading(true);
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: cleanText, targetLanguage: lang }),
      });
      const data = await res.json();
      if (data.translation) {
        setTranslations((prev) => ({ ...prev, [cacheKey]: data.translation }));
      } else {
        setTranslations((prev) => ({ ...prev, [cacheKey]: "Translation failed." }));
      }
    } catch (e) {
      console.error("Translation error", e);
      setTranslations((prev) => ({ ...prev, [cacheKey]: "Translation failed." }));
    } finally {
      setLoading(false);
    }
  };

  // Whenever targetLang is set or card is flipped, ensure active side is translated
  useEffect(() => {
    if (targetLang) {
      const activeText = flipped ? back : front;
      const cleanText = typeof activeText === "string" ? activeText : String(activeText || "");
      if (cleanText.trim()) {
        const cacheKey = `${cleanText}_${targetLang}`;
        if (!translations[cacheKey]) {
          handleTranslate(cleanText, targetLang);
        }
      }
    }
  }, [flipped, targetLang, front, back]);

  const speak = (text: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Strictly prevent card flipping and prevent dropdown toggling
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);

      // Load TTS settings from LocalStorage
      const savedVoiceUri = localStorage.getItem("tts_voice_uri");
      const savedRate = localStorage.getItem("tts_rate");

      if (savedVoiceUri) {
        const voices = window.speechSynthesis.getVoices();
        const voice = voices.find((v) => v.voiceURI === savedVoiceUri);
        if (voice) utterance.voice = voice;
      }

      if (savedRate) {
        utterance.rate = parseFloat(savedRate);
      }

      window.speechSynthesis.speak(utterance);
    }
  };

  const currentText = flipped ? back : front;
  const currentTranslation = translations[`${currentText}_${targetLang}`];

  return (
    <motion.div
      className="flip-scene w-full h-80"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
      <div className={`flip-card ${flipped ? "flipped" : ""}`}>
        {/* Front Face */}
        <div className="flip-face bg-white dark:bg-white/5 border border-ink/10 dark:border-paper/10 rounded-2xl shadow-sm flex flex-col justify-between p-6 relative">
          {/* Top Actions Bar */}
          <div className="flex justify-between items-center z-20 w-full mb-2">
            <select
              value={targetLang}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => handleTranslate(front, e.target.value)}
              className="text-[10px] bg-paper dark:bg-ink border border-ink/10 dark:border-paper/10 rounded px-1.5 py-0.5 text-muted focus:outline-none cursor-pointer"
            >
              <option value="">Translate Card</option>
              <option value="Spanish">Spanish</option>
              <option value="French">French</option>
              <option value="German">German</option>
              <option value="Chinese">Chinese</option>
              <option value="Arabic">Arabic</option>
              <option value="Hindi">Hindi</option>
              <option value="Urdu">Urdu</option>
            </select>

            <button
              type="button"
              onClick={(e) => speak(front, e)}
              className="p-1.5 rounded-lg hover:bg-ink/5 dark:hover:bg-paper/5 text-muted hover:text-accent transition-colors shrink-0 cursor-pointer z-30"
              title="Listen to Front"
              aria-label="Listen to front text"
            >
              <svg className="w-4 h-4 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
            </button>
          </div>

          {/* Main Card Content */}
          <div className="flex-1 flex flex-col justify-center text-center px-4 overflow-y-auto">
            <div className="font-display text-base sm:text-lg leading-relaxed">
              <FormattedText text={front} isFlipped={false} />
            </div>
            
            {/* Translation Output */}
            {targetLang && (
              <div className="mt-4 pt-4 border-t border-dashed border-ink/5 dark:border-paper/5">
                {loading && !currentTranslation ? (
                  <span className="text-[10px] text-muted animate-pulse">Translating...</span>
                ) : (
                  <p className="text-xs text-accent font-medium leading-relaxed italic">{currentTranslation || "Translating..."}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Back Face */}
        <div className="flip-face flip-face-back bg-ink dark:bg-paper text-paper dark:text-ink rounded-2xl shadow-sm flex flex-col justify-between p-6 relative">
          {/* Top Actions Bar */}
          <div className="flex justify-between items-center z-20 w-full mb-2">
            <select
              value={targetLang}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => handleTranslate(back, e.target.value)}
              className="text-[10px] bg-ink dark:bg-paper border border-paper/10 dark:border-ink/10 rounded px-1.5 py-0.5 text-paper/60 dark:text-ink/65 focus:outline-none cursor-pointer"
            >
              <option value="">Translate Card</option>
              <option value="Spanish">Spanish</option>
              <option value="French">French</option>
              <option value="German">German</option>
              <option value="Chinese">Chinese</option>
              <option value="Arabic">Arabic</option>
              <option value="Hindi">Hindi</option>
              <option value="Urdu">Urdu</option>
            </select>

            <button
              type="button"
              onClick={(e) => speak(back, e)}
              className="p-1.5 rounded-lg hover:bg-paper/10 dark:hover:bg-ink/5 text-paper/70 dark:text-ink/75 hover:text-accent dark:hover:text-accent transition-colors shrink-0 cursor-pointer z-30"
              title="Listen to Back"
              aria-label="Listen to back text"
            >
              <svg className="w-4 h-4 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
            </button>
          </div>

          {/* Main Card Content */}
          <div className="flex-1 flex flex-col justify-center text-center px-4 overflow-y-auto">
            <div className="font-body text-sm sm:text-base leading-relaxed">
              <FormattedText text={back} isFlipped={true} />
            </div>

            {/* Translation Output */}
            {targetLang && (
              <div className="mt-4 pt-4 border-t border-dashed border-paper/10 dark:border-ink/10">
                {loading && !currentTranslation ? (
                  <span className="text-[10px] text-paper/60 dark:text-ink/60 animate-pulse">Translating...</span>
                ) : (
                  <p className="text-xs text-accent dark:text-accent font-medium leading-relaxed italic">{currentTranslation || "Translating..."}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}