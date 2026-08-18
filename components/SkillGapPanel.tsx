"use client";

import { cn } from "@/lib/utils";
import type { SkillGap } from "@/types";

interface SkillGapPanelProps {
  gaps: SkillGap[];
  className?: string;
}

const dotColors = {
  high: "bg-amber",
  medium: "bg-blue",
  low: "bg-muted",
};

export function SkillGapPanel({ gaps, className }: SkillGapPanelProps) {
  return (
    <div className={cn("rounded-xl border border-border bg-card p-4", className)}>
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted">
        Skill Gaps
      </p>
      <ul className="mt-3 space-y-3">
        {gaps.map((gap) => (
          <li key={gap.skill} className="flex items-start gap-2.5">
            <span
              className={cn(
                "mt-1.5 h-2 w-2 flex-shrink-0 rounded-full",
                dotColors[gap.priority]
              )}
            />
            <div>
              <p className="text-sm font-medium text-text">{gap.skill}</p>
              <p className="text-xs text-muted">
                Unlocks +{gap.rolesUnlocked} more roles
              </p>
            </div>
          </li>
        ))}
        {gaps.length === 0 && (
          <p className="text-sm text-muted">No skill gaps detected — great profile!</p>
        )}
      </ul>
    </div>
  );
}
