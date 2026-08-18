"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DailyQuest } from "@/types";

interface DailyQuestsProps {
  quests: DailyQuest[];
  className?: string;
}

export function DailyQuests({ quests, className }: DailyQuestsProps) {
  return (
    <div className={cn("rounded-xl border border-border bg-card p-4", className)}>
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted">
        Daily Quests
      </p>
      <ul className="mt-3 space-y-2.5">
        {quests.map((quest) => (
          <li key={quest.id} className="flex items-start gap-2.5">
            <div
              className={cn(
                "mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border",
                quest.completed
                  ? "border-green bg-green/20 text-green"
                  : "border-border bg-bg3"
              )}
            >
              {quest.completed && <Check className="h-2.5 w-2.5" />}
            </div>
            <span
              className={cn(
                "text-sm",
                quest.completed ? "text-muted line-through" : "text-text"
              )}
            >
              {quest.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
