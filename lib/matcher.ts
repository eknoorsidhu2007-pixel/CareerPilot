import type { Job, UserProfile, WorkPreferences } from "@/types";
import { extractSkillsFromText, skillsOverlap } from "./skills";
import { cosineSimilarity, embedText, embedTexts, isEmbeddingsConfigured } from "./embeddings";

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

function profileEmbeddingText(profile: UserProfile): string {
  return profile.skills.join(", ");
}

function jobEmbeddingText(job: Job): string {
  return `${job.title}. ${job.description || ""}`;
}

/**
 * Pure keyword/skill-overlap ranking - fast, synchronous, no network or
 * API key required. This is the original scoring behavior, kept as its
 * own entry point so it stays usable (and unit-testable) on its own.
 */
export function rankJobsByKeywords(
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

/**
 * Semantic matching engine: blends keyword/skill-overlap scoring with
 * sentence-embedding cosine similarity between the candidate's profile
 * and each job's title + description (Gemini text-embedding-004).
 *
 * Falls back to rankJobsByKeywords - no network, no API key needed -
 * when GEMINI_API_KEY is unset or if the embedding calls fail for any
 * reason. A broken embeddings provider should degrade ranking quality,
 * not break job matching outright.
 */
export async function rankJobsForProfile(
  profile: UserProfile,
  jobs: Job[],
  limit = 50
): Promise<ScoredMatch[]> {
  if (jobs.length === 0) return [];
  if (!isEmbeddingsConfigured()) return rankJobsByKeywords(profile, jobs, limit);

  const prefs = defaultPreferences(profile);

  try {
    const [profileEmbedding, jobEmbeddings] = await Promise.all([
      embedText(profileEmbeddingText(profile)),
      embedTexts(jobs.map(jobEmbeddingText)),
    ]);

    return jobs
      .map((job, i) => {
        const base = scoreJobForProfile(profile, job);

        // Cosine similarity between real sentence embeddings on related
        // technical text typically lands around 0.3-0.8 rather than 0-1,
        // so a raw 0.4 would read as a weak 40% match when it usually
        // reflects a solid semantic fit. Clamped to [0, 1] before scaling
        // to a 0-100 contribution rather than passed through directly.
        const semanticSimilarity = cosineSimilarity(
          profileEmbedding,
          jobEmbeddings[i]
        );
        const semanticPct = Math.min(Math.max(semanticSimilarity, 0), 1) * 100;

        const blended = Math.round(base.score * 0.5 + semanticPct * 0.5);
        const score = Math.min(Math.max(blended, 0), 100);

        return {
          ...base,
          score,
          explanation: generateMatchExplanation(
            score,
            job,
            base.matchingSkills,
            base.missingSkills,
            prefs
          ),
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  } catch (err) {
    console.error(
      "Semantic matching failed, falling back to keyword ranking:",
      err
    );
    return rankJobsByKeywords(profile, jobs, limit);
  }
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
