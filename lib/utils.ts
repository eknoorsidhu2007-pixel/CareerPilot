import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { RANK_THRESHOLDS, type RankInfo } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getRankFromXp(xp: number): RankInfo {
  for (let i = RANK_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= RANK_THRESHOLDS[i].minXp) return RANK_THRESHOLDS[i];
  }
  return RANK_THRESHOLDS[0];
}

export function getMatchScoreColor(score: number): string {
  if (score <= 20) return "#EF4444";
  if (score <= 40) return "#F97316";
  if (score <= 60) return "#EAB308";
  if (score <= 80) return "#86EFAC";
  return "#10B981";
}

export function getMatchLabel(score: number): string {
  if (score <= 20) return "Major mismatch";
  if (score <= 40) return "Stretch role";
  if (score <= 60) return "Decent potential";
  if (score <= 80) return "Strong match";
  return "Excellent fit";
}

export function formatDate(date: string | null): string {
  if (!date) return "Recently";
  try {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "Recently";
  }
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function randomDelay(min = 1500, max = 4000): Promise<void> {
  return delay(min + Math.random() * (max - min));
}

export function getCompanyInitials(company: string): string {
  return company
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}
