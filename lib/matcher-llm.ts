import { z } from "zod";
import { generateMatchExplanation, type ScoredMatch } from "@/lib/matcher";
import {
  callWithSchema,
  isLlmConfigured,
  type LlmOptions,
  type LlmResult,
} from "@/lib/llm";
import type { Job, UserProfile, WorkPreferences } from "@/types";

/* -------------------------------------------------------------------------- */
/* Schema                                                                     */
/* -------------------------------------------------------------------------- */

export const MAX_EXPLANATION_CHARS = 400;

/**
 * `strengths` deliberately allows an empty array: a zero-overlap match produces
 * a deterministic fallback with no strengths, and the fallback must always be
 * valid against this schema.
 */
export const MatchExplanationSchema = z.strictObject({
  explanation: z.string().min(20).max(MAX_EXPLANATION_CHARS),
  strengths: z.array(z.string()).max(3),
  improvement: z.string().nullable(),
});

export type MatchExplanation = z.infer<typeof MatchExplanationSchema>;

/** Matches enriched per request. Keeps latency and provider cost bounded. */
export const DEFAULT_EXPLANATION_LIMIT = 5;

export const MATCH_EXPLANATION_SYSTEM_PROMPT = [
  "You are a concise careers advisor writing one short paragraph for a student job board.",
  "Reply with a single JSON object and nothing else: no prose, no markdown fences.",
  "Required keys, exactly these three and no others:",
  '  "explanation": string, 20-400 characters, second person, plain language, no bullet points.',
  '  "strengths": array of at most 3 short skill names drawn only from the matching skills provided.',
  '  "improvement": a single skill name to learn next, or null if there is nothing useful to add.',
  "Never invent skills, employers or requirements that are not in the input.",
].join("\n");

/* -------------------------------------------------------------------------- */
/* Deterministic fallback                                                     */
/* -------------------------------------------------------------------------- */

function clamp(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}\u2026`;
}

/**
 * Mirrors `defaultPreferences` in lib/matcher.ts, which is module-private.
 * Kept local so the deterministic matcher stays untouched by this task.
 */
function resolvePreferences(profile: UserProfile): WorkPreferences {
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

/** The existing template path, shaped into the schema. Always schema-valid. */
export function deterministicExplanation(
  score: number,
  job: Job,
  matchingSkills: string[],
  missingSkills: string[],
  preferences: WorkPreferences
): MatchExplanation {
  return {
    explanation: clamp(
      generateMatchExplanation(
        score,
        job,
        matchingSkills,
        missingSkills,
        preferences
      ),
      MAX_EXPLANATION_CHARS
    ),
    strengths: matchingSkills.slice(0, 3),
    improvement: missingSkills[0] ?? null,
  };
}

/* -------------------------------------------------------------------------- */
/* Prompting                                                                  */
/* -------------------------------------------------------------------------- */

export function buildMatchExplanationPrompt(
  score: number,
  job: Job,
  matchingSkills: string[],
  missingSkills: string[],
  preferences: WorkPreferences
): string {
  const list = (values: string[]) =>
    values.length ? values.slice(0, 10).join(", ") : "none";

  return [
    "Explain this job match to the candidate.",
    "",
    `Match score: ${score}%`,
    `Role: ${job.title || "Unknown role"}`,
    `Company: ${job.company || "Unknown company"}`,
    `Location: ${job.location || "Unspecified"}`,
    `Remote: ${job.remote || "Unspecified"}`,
    `Candidate remote preference: ${preferences.remote}`,
    `Matching skills: ${list(matchingSkills)}`,
    `Missing skills: ${list(missingSkills)}`,
  ].join("\n");
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

export async function explainMatchWithLlm(
  score: number,
  job: Job,
  matchingSkills: string[],
  missingSkills: string[],
  preferences: WorkPreferences,
  options: LlmOptions = {}
): Promise<LlmResult<MatchExplanation>> {
  const fallback = deterministicExplanation(
    score,
    job,
    matchingSkills,
    missingSkills,
    preferences
  );

  return callWithSchema(
    buildMatchExplanationPrompt(
      score,
      job,
      matchingSkills,
      missingSkills,
      preferences
    ),
    MatchExplanationSchema,
    fallback,
    { systemPrompt: MATCH_EXPLANATION_SYSTEM_PROMPT, ...options }
  );
}

export interface EnrichOptions extends LlmOptions {
  /** How many of the top matches to enrich. Defaults to 5. */
  limit?: number;
}

/**
 * Replaces the template explanation on the top matches with an LLM-written one.
 * Returns the input untouched when no API key is configured, so demo mode and
 * the test suite make zero network calls.
 *
 * The first match acts as a probe: if it falls back, the provider is assumed
 * unavailable and the remaining matches keep their deterministic explanations
 * rather than burning three more doomed attempts each.
 */
export async function enrichMatchExplanations(
  matches: ScoredMatch[],
  profile: UserProfile,
  options: EnrichOptions = {}
): Promise<ScoredMatch[]> {
  const { limit, ...llmOptions } = options;
  const count = Math.min(
    Math.max(0, limit ?? DEFAULT_EXPLANATION_LIMIT),
    matches.length
  );

  if (!isLlmConfigured() || count === 0) return matches;

  const preferences = resolvePreferences(profile);
  const explain = (match: ScoredMatch) =>
    explainMatchWithLlm(
      match.score,
      match.job,
      match.matchingSkills,
      match.missingSkills,
      preferences,
      llmOptions
    );

  const probe = await explain(matches[0]);
  if (probe.usedFallback) {
    console.warn(
      `[matcher-llm] Provider unavailable (${probe.error}); keeping deterministic explanations.`
    );
    return matches;
  }

  const enriched = [...matches];
  enriched[0] = { ...matches[0], explanation: probe.data.explanation };

  const rest = enriched.slice(1, count);
  const results = await Promise.all(rest.map(explain));

  results.forEach((result, index) => {
    if (result.usedFallback) return;
    const position = index + 1;
    enriched[position] = {
      ...enriched[position],
      explanation: result.data.explanation,
    };
  });

  return enriched;
}
