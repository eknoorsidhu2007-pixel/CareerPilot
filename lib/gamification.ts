import type { DailyQuest, RankInfo } from "@/types";
import { RANK_THRESHOLDS, XP_EVENTS, type XpEventType } from "@/types";
import { getRankFromXp } from "./utils";

export function getXpForEvent(event: XpEventType): number {
  return XP_EVENTS[event];
}

export function getDefaultDailyQuests(): DailyQuest[] {
  return [
    {
      id: "apply",
      label: "Apply to 1 internship",
      xp: 50,
      completed: false,
      type: "apply",
    },
    {
      id: "save",
      label: "Save 3 roles",
      xp: 30,
      completed: false,
      type: "save",
    },
    {
      id: "interview",
      label: "Complete a mock interview question",
      xp: 60,
      completed: false,
      type: "interview",
    },
    {
      id: "resume",
      label: "Improve one resume bullet",
      xp: 40,
      completed: false,
      type: "resume",
    },
  ];
}

export function getRankProgress(xp: number): {
  current: RankInfo;
  next: RankInfo | null;
  progress: number;
  xpToNext: number;
} {
  const current = getRankFromXp(xp);
  const currentIdx = RANK_THRESHOLDS.findIndex((r) => r.tier === current.tier);
  const next =
    currentIdx < RANK_THRESHOLDS.length - 1
      ? RANK_THRESHOLDS[currentIdx + 1]
      : null;

  if (!next) {
    return { current, next: null, progress: 100, xpToNext: 0 };
  }

  const range = next.minXp - current.minXp;
  const progress = ((xp - current.minXp) / range) * 100;
  return {
    current,
    next,
    progress: Math.min(100, Math.max(0, progress)),
    xpToNext: next.minXp - xp,
  };
}

export function getStreakDays(lastActive: string | null, streak: number): {
  days: { label: string; completed: boolean; current: boolean }[];
  count: number;
} {
  const labels = ["M", "T", "W", "T", "F", "S", "S"];
  const today = new Date().getDay();
  const mondayBased = today === 0 ? 6 : today - 1;

  const days = labels.map((label, i) => ({
    label,
    completed: i < mondayBased && streak > i,
    current: i === mondayBased,
  }));

  return { days, count: streak };
}

export function shouldAwardStreakBonus(streak: number): boolean {
  return streak > 0 && streak % 7 === 0;
}
