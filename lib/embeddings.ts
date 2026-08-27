/**
 * Sentence-embedding client for CareerPilot's semantic matching engine.
 *
 * Uses Google's Gemini embedding API (text-embedding-004) rather than a
 * local ONNX/transformers.js model: no native binaries, no bundle-size
 * risk on Vercel, and no dependency-chain vulnerabilities (an audit of
 * @xenova/transformers turned up a critical, unfixed RCE in its ONNX
 * runtime chain - not worth the risk for a public resume project).
 *
 * Falls back to null when GEMINI_API_KEY is unset so the caller can
 * degrade to keyword-only scoring instead of throwing.
 */

const EMBED_MODEL = "text-embedding-004";
const EMBED_URL = `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent`;
const BATCH_URL = `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:batchEmbedContents`;

export function isEmbeddingsConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

function apiKey(): string {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  return key;
}

/** Truncate to a safe input size - the model caps at 2048 tokens; this
 *  character limit is a conservative proxy so we never send an
 *  oversized job description or resume dump. */
function clip(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 6000);
}

export async function embedText(text: string): Promise<number[]> {
  const res = await fetch(`${EMBED_URL}?key=${apiKey()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: `models/${EMBED_MODEL}`,
      content: { parts: [{ text: clip(text) }] },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Gemini embedding request failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  const values = data?.embedding?.values;
  if (!Array.isArray(values)) {
    throw new Error("Gemini embedding response missing values");
  }
  return values as number[];
}

/** Batch-embeds many texts in one request. Gemini's batch endpoint caps
 *  at 100 requests per call, so callers embedding more than that should
 *  chunk - CareerPilot's job lists are capped well under this (<=200,
 *  usually ~50-100 after scraping), so a single chunk covers normal use. */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const chunks: string[][] = [];
  for (let i = 0; i < texts.length; i += 100) {
    chunks.push(texts.slice(i, i + 100));
  }

  const results: number[][] = [];
  for (const chunk of chunks) {
    const res = await fetch(`${BATCH_URL}?key=${apiKey()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: chunk.map((text) => ({
          model: `models/${EMBED_MODEL}`,
          content: { parts: [{ text: clip(text) }] },
        })),
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Gemini batch embedding failed (${res.status}): ${body}`);
    }

    const data = await res.json();
    const embeddings = data?.embeddings;
    if (!Array.isArray(embeddings)) {
      throw new Error("Gemini batch embedding response missing embeddings");
    }
    results.push(...embeddings.map((e: { values: number[] }) => e.values));
  }

  return results;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}