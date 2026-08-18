"use client";

import { getRankProgress } from "@/lib/gamification";
import { cn } from "@/lib/utils";

interface XPBarProps {
  xp: number;
  className?: string;
}

export function XPBar({ xp, className }: XPBarProps) {
  const { current, next, progress, xpToNext } = getRankProgress(xp);

  return (
    <div className={cn("rounded-xl border border-border bg-card p-4", className)}>
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted">
        Your Rank
      </p>
      <div className="mt-2 flex items-center gap-2">
        <span className="text-xl">🏅</span>
        <div>
          <p className="font-semibold text-text">{current.title}</p>
          <p className="text-xs text-muted">
            {current.tier} Tier
          </p>
        </div>
      </div>
      {next && (
        <>
          <p className="mt-3 font-mono text-xs text-muted">
            {xp.toLocaleString()} / {next.minXp.toLocaleString()} XP to {next.tier}
          </p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-bg3">
            <div
              className="h-full rounded-full progress-gradient transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-1.5 font-mono text-[10px] text-green">
            {xpToNext > 0 ? `${xpToNext.toLocaleString()} XP to go` : "Max tier!"}
          </p>
        </>
      )}
    </div>
  );
}
