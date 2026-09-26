/**
 * Animated Ambient Background Component for Point-of-Sale System
 * Provides a modern, high-tech fintech/retail ambient atmosphere
 * with fluid gradient orbs, subtle digital matrix grid, and micro commerce particles.
 */
import React from 'react';

interface AnimatedBackgroundProps {
  enabled?: boolean;
  darkMode?: boolean;
}

export const AnimatedBackground: React.FC<AnimatedBackgroundProps> = ({
  enabled = true,
  darkMode = false,
}) => {
  if (!enabled) {
    return (
      <div className="pointer-events-none fixed inset-0 z-0 bg-slate-50 dark:bg-slate-950 transition-colors duration-500" />
    );
  }

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden select-none transition-colors duration-700 bg-slate-50 dark:bg-slate-950"
    >
      {/* Dynamic Aurora Ambient Glowing Orbs */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Orb 1: Primary Royal Blue & Sky Glow (Top-Left Drift) */}
        <div
          className={`absolute -top-32 -left-32 h-[550px] w-[550px] rounded-full filter blur-[110px] md:blur-[130px] opacity-70 dark:opacity-40 animate-pos-aurora-1 ${
            darkMode
              ? 'bg-gradient-to-tr from-blue-700/40 via-indigo-600/30 to-cyan-500/20'
              : 'bg-gradient-to-tr from-blue-400/25 via-sky-300/30 to-blue-200/20'
          }`}
        />

        {/* Orb 2: Retail Indigo & Violet Hue (Bottom-Right Counter-Drift) */}
        <div
          className={`absolute -bottom-40 -right-40 h-[620px] w-[620px] rounded-full filter blur-[120px] md:blur-[140px] opacity-65 dark:opacity-35 animate-pos-aurora-2 ${
            darkMode
              ? 'bg-gradient-to-bl from-indigo-700/35 via-blue-800/30 to-purple-900/25'
              : 'bg-gradient-to-bl from-indigo-300/25 via-blue-200/30 to-slate-200/25'
          }`}
        />

        {/* Orb 3: Sales Emerald & Mint Glow (Center Ambience representing revenue/growth) */}
        <div
          className={`absolute top-1/3 left-1/2 -translate-x-1/2 h-[480px] w-[480px] rounded-full filter blur-[115px] opacity-50 dark:opacity-25 animate-pos-aurora-3 ${
            darkMode
              ? 'bg-gradient-to-r from-emerald-600/20 via-teal-600/25 to-blue-600/20'
              : 'bg-gradient-to-r from-emerald-400/15 via-teal-300/20 to-sky-300/15'
          }`}
        />
      </div>

      {/* Subtle Digital Commerce Grid Pattern */}
      <div className="absolute inset-0 pos-grid-pattern animate-pos-grid" />

      {/* Precision Micro Dot Matrix */}
      <div className="absolute inset-0 pos-dots-pattern opacity-80" />

      {/* Subtle Floating Commerce Ambient Nodes */}
      <div className="absolute inset-0">
        <span
          className="absolute left-[15%] top-[25%] h-2 w-2 rounded-full bg-blue-500/30 dark:bg-cyan-400/25 animate-pos-particle"
          style={{ animationDelay: '0s', animationDuration: '8s' }}
        />
        <span
          className="absolute left-[38%] top-[65%] h-2.5 w-2.5 rounded-full bg-emerald-500/25 dark:bg-emerald-400/20 animate-pos-particle"
          style={{ animationDelay: '2.5s', animationDuration: '10s' }}
        />
        <span
          className="absolute left-[72%] top-[30%] h-2 w-2 rounded-full bg-indigo-500/30 dark:bg-indigo-400/25 animate-pos-particle"
          style={{ animationDelay: '4.2s', animationDuration: '9s' }}
        />
        <span
          className="absolute left-[85%] top-[75%] h-3 w-3 rounded-full bg-sky-500/20 dark:bg-blue-400/20 animate-pos-particle"
          style={{ animationDelay: '1.2s', animationDuration: '11s' }}
        />
        <span
          className="absolute left-[55%] top-[18%] h-1.5 w-1.5 rounded-full bg-teal-500/30 dark:bg-teal-300/25 animate-pos-particle"
          style={{ animationDelay: '5.8s', animationDuration: '7.5s' }}
        />
      </div>

      {/* Soft Vignette Overlay to maintain focal contrast on content */}
      <div
        className={`absolute inset-0 ${
          darkMode
            ? 'bg-radial-gradient from-transparent via-slate-950/30 to-slate-950/70'
            : 'bg-radial-gradient from-transparent via-slate-50/20 to-slate-100/40'
        }`}
      />
    </div>
  );
};
