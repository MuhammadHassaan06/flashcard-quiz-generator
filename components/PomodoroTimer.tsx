"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function PomodoroTimer() {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<"work" | "break">("work");
  const [timeLeft, setTimeLeft] = useState(25 * 60); // 25 minutes
  const [isRunning, setIsRunning] = useState(false);
  const [ambientSound, setAmbientSound] = useState<"none" | "white-noise" | "rain">("none");

  const audioCtxRef = useRef<AudioContext | null>(null);
  const noiseNodeRef = useRef<AudioNode | null>(null);

  // Timer Countdown Logic
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isRunning && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      // Switch modes automatically
      if (mode === "work") {
        setMode("break");
        setTimeLeft(5 * 60); // 5 minute break
      } else {
        setMode("work");
        setTimeLeft(25 * 60); // 25 minute work
      }
      setIsRunning(false);
    }
    return () => clearInterval(timer);
  }, [isRunning, timeLeft, mode]);

  // Web Audio API Synth for Ambient White Noise / Rain Sounds
  useEffect(() => {
    if (ambientSound === "none") {
      if (noiseNodeRef.current) {
        (noiseNodeRef.current as any).stop?.();
        noiseNodeRef.current.disconnect();
        noiseNodeRef.current = null;
      }
      return;
    }

    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") ctx.resume();

      const bufferSize = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = buffer.getChannelData(0);

      // Generate White Noise / Rain frequencies
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        if (ambientSound === "rain") {
          // Pink noise filter algorithm for soothing rain simulation
          output[i] = (lastOut + 0.02 * white) / 1.02;
          lastOut = output[i];
          output[i] *= 3.5;
        } else {
          // Softened White noise
          output[i] = white * 0.05;
        }
      }

      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = buffer;
      whiteNoise.loop = true;

      const gainNode = ctx.createGain();
      gainNode.gain.value = ambientSound === "rain" ? 0.08 : 0.04;

      whiteNoise.connect(gainNode);
      gainNode.connect(ctx.destination);
      whiteNoise.start();

      noiseNodeRef.current = whiteNoise;
    } catch (e) {
      console.error("Ambient Audio synth error:", e);
    }

    return () => {
      if (noiseNodeRef.current) {
        (noiseNodeRef.current as any).stop?.();
        noiseNodeRef.current.disconnect();
        noiseNodeRef.current = null;
      }
    };
  }, [ambientSound]);

  const toggleTimer = () => setIsRunning(!isRunning);
  const resetTimer = () => {
    setIsRunning(false);
    setTimeLeft(mode === "work" ? 25 * 60 : 5 * 60);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Minimized Floating Badge */}
      {!isOpen && (
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsOpen(true)}
          className="bg-ink dark:bg-paper text-paper dark:text-ink px-4 py-2.5 rounded-full shadow-2xl flex items-center gap-2.5 border border-ink/10 dark:border-paper/10 text-xs font-bold"
        >
          <span className="h-2 w-2 rounded-full bg-accent animate-ping" />
          <span>⏱️ Pomodoro: {formatTime(timeLeft)}</span>
        </motion.button>
      )}

      {/* Expanded Pomodoro Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            className="w-72 bg-white dark:bg-ink/95 border border-ink/10 dark:border-paper/10 rounded-3xl p-5 shadow-2xl backdrop-blur-xl text-left relative"
          >
            {/* Header */}
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <span className="text-base">⏱️</span>
                <h3 className="font-display text-sm font-bold">Focus Pomodoro</h3>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-muted hover:text-ink dark:hover:text-paper text-xs font-bold"
              >
                ✕
              </button>
            </div>

            {/* Mode Selector Tabs */}
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-ink/5 dark:bg-paper/5 rounded-xl mb-4">
              <button
                onClick={() => {
                  setMode("work");
                  setTimeLeft(25 * 60);
                  setIsRunning(false);
                }}
                className={`py-1 text-[11px] font-bold rounded-lg transition-all ${
                  mode === "work"
                    ? "bg-accent text-white shadow-sm"
                    : "text-muted hover:text-ink dark:hover:text-paper"
                }`}
              >
                Focus (25m)
              </button>
              <button
                onClick={() => {
                  setMode("break");
                  setTimeLeft(5 * 60);
                  setIsRunning(false);
                }}
                className={`py-1 text-[11px] font-bold rounded-lg transition-all ${
                  mode === "break"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-muted hover:text-ink dark:hover:text-paper"
                }`}
              >
                Break (5m)
              </button>
            </div>

            {/* Main Timer Display */}
            <div className="text-center my-3">
              <span className="font-mono text-4xl font-extrabold tracking-tight text-ink dark:text-paper">
                {formatTime(timeLeft)}
              </span>
              <p className="text-[10px] text-muted font-semibold mt-1">
                {mode === "work" ? "Stay focused on cards" : "Rest your eyes & stretch"}
              </p>
            </div>

            {/* Controls */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={toggleTimer}
                className={`flex-1 py-2 rounded-xl text-xs font-bold text-white shadow-sm transition-all ${
                  isRunning ? "bg-amber-500 hover:bg-amber-600" : "bg-accent hover:opacity-90"
                }`}
              >
                {isRunning ? "Pause" : "Start Focus"}
              </button>
              <button
                onClick={resetTimer}
                className="px-3 py-2 rounded-xl border border-ink/10 dark:border-paper/10 text-xs font-bold text-muted hover:text-ink dark:hover:text-paper"
              >
                Reset
              </button>
            </div>

            {/* Ambient Sound Generator */}
            <div className="pt-3 border-t border-ink/5 dark:border-paper/10">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-muted mb-1.5">
                🎵 Ambient Sound Noise
              </label>
              <select
                value={ambientSound}
                onChange={(e) => setAmbientSound(e.target.value as any)}
                className="w-full bg-ink/5 dark:bg-paper/5 border border-ink/10 dark:border-paper/10 rounded-xl px-2.5 py-1.5 text-xs font-medium focus:outline-none cursor-pointer"
              >
                <option value="none">Off (Silent)</option>
                <option value="rain">🌧️ Soothing Rain Synth</option>
                <option value="white-noise">📻 Soft White Noise</option>
              </select>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
