import type { z } from "zod";
import { formatIssues } from "@/lib/schemas";

/* -------------------------------------------------------------------------- */
/* Configuration                                                              */
/* -------------------------------------------------------------------------- */

export const DEFAULT_MODEL = "gemini-3.5-flash-lite";
export const DEFAULT_MAX_ATTEMPTS = 3;
export const DEFAULT_TIMEOUT_MS = 8_000;

const GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models";

/** Marker the retry loop uses to append validation feedback to a prompt. */
export const CORRECTION_HEADER =
  "Your previous response was rejected. Fix the following problem and reply again with JSON only:";

export interface LlmOptions {
  /** Total attempts, including the first. Defaults to 3. */
  maxAttempts?: number;
  /** Per-attempt abort deadline in milliseconds. Defaults to 8000. */
  timeoutMs?: number;
  /** Overrides GEMINI_MODEL / the built-in default. */
  model?: string;
  /** Optional system instruction sent alongside the prompt. */
  systemPrompt?: string;
  temperature?: number;
}

export interface LlmResult<T> {
  data: T;
  /** Number of provider calls made. 0 when no API key is configured. */
  attempts: number;
  usedFallback: boolean;
  /** Present only when the deterministic fallback was used. */
  error?: string;
}

/**
 * Read at call time, never at module load, so tests and demo mode can toggle it.
 */
export function isLlmConfigured(): boolean {
  const key = process.env.GEMINI_API_KEY;
  return typeof key === "string" && key.trim().length > 0;
}

/* -------------------------------------------------------------------------- */
/* Response cleaning                                                          */
/* -------------------------------------------------------------------------- */

/** Removes a single surrounding markdown fence, with or without a language tag. */
export function stripCodeFences(raw: string): string {
  const trimmed = raw.trim();
  const fenced = /^```[a-zA-Z0-9_-]*\s*\n?([\s\S]*?)\n?\s*```$/.exec(trimmed);
  return fenced ? fenced[1].trim() : trimmed;
}

/**
 * Best-effort isolation of the JSON payload: strips fences, then salvages the
 * outermost object or array if the model wrapped it in prose.
 */
export function extractJsonCandidate(raw: string): string {
  const stripped = stripCodeFences(raw);
  if (stripped.startsWith("{") || stripped.startsWith("[")) return stripped;

  const firstBrace = stripped.indexOf("{");
  const lastBrace = stripped.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return stripped.slice(firstBrace, lastBrace + 1);
  }

  const firstBracket = stripped.indexOf("[");
  const lastBracket = stripped.lastIndexOf("]");
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    return stripped.slice(firstBracket, lastBracket + 1);
  }

  return stripped;
}

/* -------------------------------------------------------------------------- */
/* Provider adapter — the only Gemini-specific code in the repo                */
/* -------------------------------------------------------------------------- */

interface GeminiResponseBody {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
}

interface AdapterArgs {
  model: string;
  timeoutMs: number;
  temperature?: number;
  systemPrompt?: string;
}

/** Swap this one function to move the project to Groq or any other provider. */
async function callGemini(prompt: string, args: AdapterArgs): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), args.timeoutMs);

  try {
    const response = await fetch(
      `${GEMINI_ENDPOINT}/${args.model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          ...(args.systemPrompt
            ? { systemInstruction: { parts: [{ text: args.systemPrompt }] } }
            : {}),
          generationConfig: {
            responseMimeType: "application/json",
            ...(args.temperature === undefined
              ? {}
              : { temperature: args.temperature }),
          },
        }),
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `Gemini request failed with ${response.status}: ${body.slice(0, 200)}`.trim()
      );
    }

    const json = (await response.json()) as GeminiResponseBody;
    const text = (json.candidates?.[0]?.content?.parts ?? [])
      .map((part) => part.text ?? "")
      .join("");

    if (!text.trim()) throw new Error("Gemini returned an empty completion");
    return text;
  } finally {
    clearTimeout(timer);
  }
}

/* -------------------------------------------------------------------------- */
/* Retry loop                                                                 */
/* -------------------------------------------------------------------------- */

function describeIssues(error: z.ZodError): string {
  return formatIssues(error)
    .map((issue) => `${issue.path}: ${issue.message}`)
    .join("; ");
}

function describeThrown(err: unknown, timeoutMs: number): string {
  const name = (err as { name?: string } | null)?.name;
  if (name === "AbortError" || name === "TimeoutError") {
    return `Request timed out after ${timeoutMs}ms`;
  }
  return err instanceof Error ? err.message : String(err);
}

function finalizeFallback<T>(
  schema: z.ZodType<T>,
  fallback: T,
  attempts: number,
  error: string
): LlmResult<T> {
  const check = schema.safeParse(fallback);
  if (!check.success) {
    // Never throw into a request handler: log loudly and degrade anyway.
    console.error(
      `[llm] Deterministic fallback failed its own schema: ${describeIssues(check.error)}`
    );
    return { data: fallback, attempts, usedFallback: true, error };
  }
  return { data: check.data, attempts, usedFallback: true, error };
}

/**
 * Calls the model, validates the JSON response against `schema`, and re-prompts
 * with the validation error on failure. Returns `fallback` once attempts are
 * exhausted or no API key is configured. Never throws.
 */
export async function callWithSchema<T>(
  prompt: string,
  schema: z.ZodType<T>,
  fallback: T,
  options: LlmOptions = {}
): Promise<LlmResult<T>> {
  const maxAttempts = Math.max(1, options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS);
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const temperature = options.temperature;
  const model = options.model || process.env.GEMINI_MODEL || DEFAULT_MODEL;

  if (!isLlmConfigured()) {
    return finalizeFallback(schema, fallback, 0, "GEMINI_API_KEY is not set");
  }

  let lastError = "Unknown error";
  let currentPrompt = prompt;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const raw = await callGemini(currentPrompt, {
        model,
        timeoutMs,
        temperature,
        systemPrompt: options.systemPrompt,
      });

      const candidate = extractJsonCandidate(raw);

      let parsed: unknown;
      try {
        parsed = JSON.parse(candidate);
      } catch {
        throw new Error(
          `Response was not valid JSON. Received: ${candidate.slice(0, 200)}`
        );
      }

      const result = schema.safeParse(parsed);
      if (result.success) {
        return { data: result.data, attempts: attempt, usedFallback: false };
      }

      lastError = `Schema validation failed - ${describeIssues(result.error)}`;
    } catch (err) {
      lastError = describeThrown(err, timeoutMs);
    }

    currentPrompt = `${prompt}\n\n${CORRECTION_HEADER}\n${lastError}`;
  }

  console.warn(
    `[llm] ${maxAttempts} attempt(s) failed; using deterministic fallback. Last error: ${lastError}`
  );
  return finalizeFallback(schema, fallback, maxAttempts, lastError);
}
