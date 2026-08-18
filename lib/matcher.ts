import type { Job, UserProfile, WorkPreferences } from "@/types";
import { extractSkillsFromText, skillsOverlap } from "./skills";

export interface ScoredMatch {
  job: Job;
  score: number;
  matchingSkills: string[];
  missingSkills: string[];
  explanation?: string;
}

function defaultPreferences(profile: UserProfile): WorkPreferences {
  return (
    profile.preferences || {
      remote: "any",
      location: profile.location,
      industries: [],
      salary_min: 0,
      salary_max: 200000,
    }
  );
}

function jobSkills(job: Job): string[] {
  if (job.skills_required?.length) return job.skills_required;
  return extractSkillsFromText(
    `${job.title} ${job.description || ""}`
  );
}

export function scoreMatch(
  userSkills: string[],
  jobSkillsRequired: string[],
  preferences: WorkPreferences,
  job: Job
): { score: number; matchingSkills: string[]; missingSkills: string[] } {
  const { matching, missing } = skillsOverlap(userSkills, jobSkillsRequired);

  let score =
    (matching.length / Math.max(jobSkillsRequired.length, 1)) * 60;

  const remote = (job.remote || job.location || "").toLowerCase();
  if (remote.includes("remote") && preferences.remote !== "onsite") score += 10;
  if (
    preferences.location &&
    job.location?.toLowerCase().includes(preferences.location.toLowerCase())
  )
    score += 10;
  if (job.title?.toLowerCase().includes("intern")) score += 5;
  if (job.title?.toLowerCase().includes("junior")) score += 3;
  if (job.title?.toLowerCase().includes("co-op")) score += 4;
  if (
    job.title?.toLowerCase().includes("senior") &&
    !userSkills.some((s) => s.toLowerCase().includes("senior"))
  )
    score -= 5;

  return {
    score: Math.min(Math.max(Math.round(score), 0), 100),
    matchingSkills: matching,
    missingSkills: missing,
  };
}

export function generateMatchExplanation(
  score: number,
  job: Job,
  matchingSkills: string[],
  missingSkills: string[],
  preferences: WorkPreferences
): string {
  const matchedList =
    matchingSkills.length > 0
      ? matchingSkills.slice(0, 5).join(", ")
      : "general background";

  let explanation = `You match ${score}% because ${matchingSkills.length} of your skills align with this role (${matchedList}).`;

  const remote = (job.remote || job.location || "").toLowerCase();
  if (remote.includes("remote") && preferences.remote !== "onsite") {
    explanation += " This role matches your remote preference.";
  }

  if (score < 60 && missingSkills.length > 0) {
    explanation += ` Learning ${missingSkills[0]} could improve your fit.`;
  }

  return explanation;
}

export function scoreJobForProfile(
  profile: UserProfile,
  job: Job
): Omit<ScoredMatch, "explanation"> {
  const prefs = defaultPreferences(profile);
  const required = jobSkills(job);
  const { score, matchingSkills, missingSkills } = scoreMatch(
    profile.skills,
    required,
    prefs,
    job
  );

  return { job, score, matchingSkills, missingSkills };
}

export function rankJobsForProfile(
  profile: UserProfile,
  jobs: Job[],
  limit = 50
): ScoredMatch[] {
  const prefs = defaultPreferences(profile);

  return jobs
    .map((job) => {
      const base = scoreJobForProfile(profile, job);
      return {
        ...base,
        explanation: generateMatchExplanation(
          base.score,
          job,
          base.matchingSkills,
          base.missingSkills,
          prefs
        ),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function analyzeSkillGaps(
  profile: UserProfile,
  jobs: Job[]
): { skill: string; rolesUnlocked: number; priority: "high" | "medium" | "low" }[] {
  const userLower = profile.skills.map((s) => s.toLowerCase());
  const skillCounts = new Map<string, number>();

  for (const job of jobs) {
    for (const skill of jobSkills(job)) {
      const norm = skill.toLowerCase();
      const has = userLower.some(
        (u) => u.includes(norm) || norm.includes(u)
      );
      if (!has) {
        skillCounts.set(skill, (skillCounts.get(skill) || 0) + 1);
      }
    }
  }

  return [...skillCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([skill, count], i) => ({
      skill,
      rolesUnlocked: count,
      priority: (i === 0 ? "high" : i < 3 ? "medium" : "low") as
        | "high"
        | "medium"
        | "low",
    }));
}
