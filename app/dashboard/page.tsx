"use client";

import { useCallback, useEffect, useState } from "react";
import { Flame, Filter } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { JobCard } from "@/components/JobCard";
import { JobMatchModal } from "@/components/JobMatchModal";
import { XPBar } from "@/components/XPBar";
import { DailyQuests } from "@/components/DailyQuests";
import { SkillGapPanel } from "@/components/SkillGapPanel";
import { Button } from "@/components/ui/button";
import {
  getDemoApplications,
  getDemoMatches,
  getDemoProfile,
  getDemoUserId,
  saveDemoApplications,
  saveDemoMatches,
} from "@/lib/demo-store";
import { getDefaultDailyQuests, getStreakDays } from "@/lib/gamification";
import type {
  Application,
  DailyQuest,
  JobMatch,
  SkillGap,
  UserProfile,
} from "@/types";

export default function DashboardPage() {
  const [matches, setMatches] = useState<JobMatch[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<JobMatch | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [quests, setQuests] = useState<DailyQuest[]>(getDefaultDailyQuests());
  const [skillGaps, setSkillGaps] = useState<SkillGap[]>([]);
  const [loading, setLoading] = useState(true);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const userId = getDemoUserId();

  const loadData = useCallback(async () => {
    const prof = getDemoProfile();
    setProfile(prof);
    setApplications(getDemoApplications());

    let matchData = getDemoMatches();
    if (matchData.length === 0 && prof) {
      const res = await fetch("/api/match-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, profile: prof }),
      });
      if (res.ok) {
        const data = await res.json();
        matchData = data.matches;
        saveDemoMatches(matchData);
        if (data.skillGaps) setSkillGaps(data.skillGaps);
      }
    } else {
      setMatches(matchData);
      const gaps = sessionStorage.getItem("cp_skill_gaps");
      if (gaps) setSkillGaps(JSON.parse(gaps));
    }

    setMatches(matchData);
    const saved = getDemoApplications()
      .filter((a) => a.status === "saved")
      .map((a) => a.job_id);
    setSavedIds(new Set(saved));
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    loadData();
    fetch("/api/scrape-jobs", { method: "POST" }).catch(() => {});
  }, [loadData]);

  const awardXp = async (eventType: string) => {
    const res = await fetch("/api/xp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, eventType }),
    });
    if (res.ok) {
      const { totalXp, rank } = await res.json();
      if (profile) {
        const updated = { ...profile, xp: totalXp, rank };
        setProfile(updated);
        const { saveDemoProfile } = await import("@/lib/demo-store");
        saveDemoProfile(updated);
      }
    }
  };

  const handleSave = async (match: JobMatch) => {
    const isSaved = savedIds.has(match.job_id);
    const app: Application = {
      id: crypto.randomUUID(),
      user_id: userId,
      job_id: match.job_id,
      status: "saved",
      notes: "",
      deadline: null,
      job: match.job,
    };

    const updated = [
      ...applications.filter((a) => a.job_id !== match.job_id),
      app,
    ];
    setApplications(updated);
    saveDemoApplications(updated);
    setSavedIds(new Set([...Array.from(savedIds), match.job_id]));

    if (!isSaved) {
      await awardXp("save_job");
      setQuests((q) =>
        q.map((quest) =>
          quest.id === "save" ? { ...quest, completed: true } : quest
        )
      );
    }
  };

  const handleApply = async (match: JobMatch) => {
    const app: Application = {
      id: crypto.randomUUID(),
      user_id: userId,
      job_id: match.job_id,
      status: "applied",
      notes: "",
      deadline: null,
      job: match.job,
    };

    const updated = [
      ...applications.filter((a) => a.job_id !== match.job_id),
      app,
    ];
    setApplications(updated);
    saveDemoApplications(updated);
    await awardXp("apply_to_job");
    setQuests((q) =>
      q.map((quest) =>
        quest.id === "apply" ? { ...quest, completed: true } : quest
      )
    );
    window.open(match.job.url, "_blank");
    setSelectedMatch(null);
  };

  const streak = getStreakDays(profile?.last_active || null, profile?.streak || 7);
  const applyQuestProgress = quests.find((q) => q.id === "apply")?.completed
    ? 1
    : 0;

  return (
    <div className="min-h-screen bg-bg">
      <Navbar />
      <div className="flex">
        <DashboardSidebar />

        <main className="flex-1 min-w-0 px-6 py-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-xl font-semibold">Your matches today</h1>
            <Button variant="outline" size="sm">
              <Filter className="h-3.5 w-3.5" />
              Filter
            </Button>
          </div>

          {/* Daily quest banner */}
          <div className="mb-6 rounded-xl border border-border bg-bg2 p-4">
            <div className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-amber" />
              <p className="text-sm font-medium">
                Daily Quest — Apply to 3 internships{" "}
                <span className="text-muted">(+150 XP)</span>
              </p>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <div className="flex-1 h-1 overflow-hidden rounded-full bg-bg3">
                <div
                  className="h-full progress-gradient"
                  style={{ width: `${(applyQuestProgress / 3) * 100}%` }}
                />
              </div>
              <span className="font-mono text-xs text-muted">
                {applyQuestProgress} of 3 complete
              </span>
            </div>
          </div>

          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-36 animate-pulse rounded-xl bg-card"
                />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {matches.map((match) => (
                <JobCard
                  key={match.id}
                  match={match}
                  saved={savedIds.has(match.job_id)}
                  onView={() => setSelectedMatch(match)}
                  onSave={() => handleSave(match)}
                  onApply={() => handleApply(match)}
                />
              ))}
              {matches.length === 0 && (
                <p className="text-center text-muted py-12">
                  No matches yet. Complete your profile to get started.
                </p>
              )}
            </div>
          )}
        </main>

        <aside className="hidden w-72 flex-shrink-0 border-l border-border p-4 space-y-4 xl:block">
          <XPBar xp={profile?.xp || 2840} />

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted">
                Streak — {streak.count} days
              </p>
              <Flame className="h-4 w-4 text-amber" />
            </div>
            <div className="mt-3 flex justify-between gap-1">
              {streak.days.map((day, i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-mono ${
                      day.completed
                        ? "bg-green/20 text-green border border-green/30"
                        : day.current
                        ? "bg-blue/20 text-blue border border-blue/30"
                        : "bg-bg3 text-muted"
                    }`}
                  >
                    {day.completed ? "✓" : day.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DailyQuests quests={quests} />
          <SkillGapPanel gaps={skillGaps} />
        </aside>
      </div>

      <JobMatchModal
        match={selectedMatch}
        onClose={() => setSelectedMatch(null)}
        onApply={() => selectedMatch && handleApply(selectedMatch)}
        onSave={() => selectedMatch && handleSave(selectedMatch)}
      />
    </div>
  );
}
