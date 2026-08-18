"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SkillChipProps {
  skill: string;
  selected?: boolean;
  onToggle?: () => void;
  onRemove?: () => void;
  suggest?: boolean;
}

export function SkillChip({
  skill,
  selected = false,
  onToggle,
  onRemove,
  suggest = false,
}: SkillChipProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors font-sans",
        selected
          ? "bg-blue/10 border border-blue/40 text-text"
          : suggest
          ? "bg-card2 text-muted hover:text-text hover:bg-bg3"
          : "bg-card2 text-muted hover:text-text border border-transparent"
      )}
    >
      {selected && (
        <span className="h-1.5 w-1.5 rounded-full bg-blue flex-shrink-0" />
      )}
      <span>{skill}</span>
      {selected && onRemove && (
        <span
          role="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 text-muted hover:text-text"
        >
          <X className="h-3 w-3" />
        </span>
      )}
    </button>
  );
}
