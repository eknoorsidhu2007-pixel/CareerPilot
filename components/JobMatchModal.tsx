"use client";

import { X, ExternalLink } from "lucide-react";
import { MatchRing } from "./MatchRing";
import { Button } from "./ui/button";
import { getMatchLabel } from "@/lib/utils";
import type { JobMatch } from "@/types";

interface JobMatchModalProps {
  match: JobMatch | null;
  onClose: () => void;
  onApply: () => void;
  onSave: () => void;
}

export function JobMatchModal({
  match,
  onClose,
  onApply,
  onSave,
}: JobMatchModalProps) {
  if (!match) return null;

  const { job, score, explanation } = match;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-bg/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-muted hover:text-text"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-start gap-4">
          <div>
            <h2 className="text-xl font-semibold pr-8">{job.title}</h2>
            <p className="mt-1 text-sm text-muted">
              {job.company} · {job.location}
            </p>
          </div>
          <MatchRing score={score} size={64} animated={false} />
        </div>

        <p className="mt-1 font-mono text-xs text-muted">
          {getMatchLabel(score)}
        </p>

        {explanation && (
          <p className="mt-4 text-sm leading-relaxed text-muted">
            {explanation}
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-1.5">
          {(job.skills_required || []).map((s) => (
            <span
              key={s}
              className="rounded-md bg-bg3 px-2 py-0.5 font-mono text-xs text-muted"
            >
              {s}
            </span>
          ))}
        </div>

        {job.salary_range && (
          <p className="mt-3 font-mono text-sm text-green">
            {job.salary_range}
          </p>
        )}

        <div className="mt-6 flex gap-2">
          <Button onClick={onApply} className="flex-1">
            Apply Now
          </Button>
          <Button variant="outline" onClick={onSave}>
            Save
          </Button>
          <a href={job.url} target="_blank" rel="noopener noreferrer">
            <Button variant="ghost" size="icon">
              <ExternalLink className="h-4 w-4" />
            </Button>
          </a>
        </div>
      </div>
    </div>
  );
}
