"use client";

import { Bookmark, ExternalLink } from "lucide-react";
import { MatchRing } from "./MatchRing";
import { Button } from "./ui/button";
import { cn, formatDate, getCompanyInitials } from "@/lib/utils";
import type { JobMatch } from "@/types";

interface JobCardProps {
  match: JobMatch;
  onSave?: () => void;
  onApply?: () => void;
  onView?: () => void;
  saved?: boolean;
}

export function JobCard({
  match,
  onSave,
  onApply,
  onView,
  saved = false,
}: JobCardProps) {
  const { job, score } = match;
  const isLegendary = score >= 90;
  const isRare = score >= 85 && score < 90;

  return (
    <article
      className="group rounded-xl border border-border bg-card p-5 transition-colors hover:border-border/80 hover:bg-card/80 cursor-pointer"
      onClick={onView}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-card2 border border-border font-mono text-sm text-muted">
            {getCompanyInitials(job.company)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-text truncate">{job.title}</h3>
              {isLegendary && (
                <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[10px] font-medium text-amber border border-amber/30 bg-amber/10">
                  ⚡ LEGENDARY
                </span>
              )}
              {isRare && !isLegendary && (
                <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[10px] font-medium text-blue border border-blue/30 bg-blue/10">
                  ◆ RARE
                </span>
              )}
            </div>
            <p className="mt-0.5 text-sm text-muted truncate">
              {job.company} · {job.location} · {job.remote}
            </p>
            <p className="mt-1 font-mono text-xs text-muted/70">
              Posted {formatDate(job.posted_date)}
              {job.applicant_count
                ? ` · ~${job.applicant_count} applicants`
                : ""}
            </p>
          </div>
        </div>
        <MatchRing score={score} />
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {(job.skills_required || []).slice(0, 4).map((skill) => (
          <span
            key={skill}
            className="rounded-md bg-bg3 px-2 py-0.5 font-mono text-xs text-muted"
          >
            {skill}
          </span>
        ))}
      </div>

      <div
        className="mt-4 flex items-center gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        <Button
          variant="outline"
          size="sm"
          className={cn(saved && "border-green/40 text-green")}
          onClick={onSave}
        >
          <Bookmark className={cn("h-3.5 w-3.5", saved && "fill-green")} />
          {saved ? "Saved" : "Save"}
        </Button>
        <Button variant="default" size="sm" onClick={onApply}>
          Apply
        </Button>
        <a
          href={job.job_url}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto text-muted hover:text-text"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>
    </article>
  );
}
