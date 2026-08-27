import { z } from 'zod';
import {
  CORRECTION_HEADER,
  DEFAULT_MODEL,
  callWithSchema,
  extractJsonCandidate,
  isLlmConfigured,
  stripCodeFences,
} from '@/lib/llm';

const TestSchema = z.strictObject({
  answer: z.string().min(3),
  count: z.number(),
});

type TestShape = z.infer<typeof TestSchema>;

const fallback: TestShape = { answer: 'deterministic', count: 0 };

function geminiOk(text: string) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }),
    text: async () => text,
  } as unknown as Response;
}

function geminiError(status: number, body = 'rate limited') {
  return {
    ok: false,
    status,
    statusText: 'Too Many Requests',
    json: async () => ({}),
    text: async () => body,
  } as unknown as Response;
}

const mockFetch = jest.fn();

function promptFor(callIndex: number): string {
  const init = mockFetch.mock.calls[callIndex][1] as RequestInit;
  const body = JSON.parse(String(init.body)) as {
    contents: Array<{ parts: Array<{ text: string }> }>;
  };
  return body.contents[0].parts[0].text;
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.GEMINI_API_KEY = 'test-key';
  global.fetch = mockFetch as unknown as typeof fetch;
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  delete process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_MODEL;
});

describe('isLlmConfigured', () => {
  it('is false when the key is absent', () => {
    delete process.env.GEMINI_API_KEY;
    expect(isLlmConfigured()).toBe(false);
  });

  it('is false when the key is blank', () => {
    process.env.GEMINI_API_KEY = '   ';
    expect(isLlmConfigured()).toBe(false);
  });

  it('is true when the key is set', () => {
    expect(isLlmConfigured()).toBe(true);
  });
});

describe('stripCodeFences', () => {
  it('removes a fence with a language tag', () => {
    expect(stripCodeFences('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it('removes a bare fence', () => {
    expect(stripCodeFences('```\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it('leaves unfenced text alone', () => {
    expect(stripCodeFences('  {"a":1}  ')).toBe('{"a":1}');
  });
});

describe('extractJsonCandidate', () => {
  it('salvages an object wrapped in prose', () => {
    expect(extractJsonCandidate('Sure! {"a":1} Hope that helps.')).toBe('{"a":1}');
  });

  it('salvages an array wrapped in prose', () => {
    expect(extractJsonCandidate('Here you go: [1,2,3]')).toBe('[1,2,3]');
  });
});

describe('callWithSchema — no API key', () => {
  it('returns the fallback without making a request', async () => {
    delete process.env.GEMINI_API_KEY;

    const result = await callWithSchema('prompt', TestSchema, fallback);

    expect(result).toMatchObject({
      data: fallback,
      attempts: 0,
      usedFallback: true,
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe('callWithSchema — happy path', () => {
  it('validates and returns the first response', async () => {
    mockFetch.mockResolvedValue(
      geminiOk(JSON.stringify({ answer: 'yes', count: 2 }))
    );

    const result = await callWithSchema('prompt', TestSchema, fallback);

    expect(result.data).toEqual({ answer: 'yes', count: 2 });
    expect(result.attempts).toBe(1);
    expect(result.usedFallback).toBe(false);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('sends the API key as a header and targets the configured model', async () => {
    process.env.GEMINI_MODEL = 'gemini-1.5-pro';
    mockFetch.mockResolvedValue(
      geminiOk(JSON.stringify({ answer: 'yes', count: 2 }))
    );

    await callWithSchema('prompt', TestSchema, fallback);

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('gemini-1.5-pro:generateContent');
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe(
      'test-key'
    );
  });

  it('falls back to the default model when none is configured', async () => {
    mockFetch.mockResolvedValue(
      geminiOk(JSON.stringify({ answer: 'yes', count: 2 }))
    );

    await callWithSchema('prompt', TestSchema, fallback);

    expect(mockFetch.mock.calls[0][0]).toContain(DEFAULT_MODEL);
  });

  it('accepts a fenced response', async () => {
    mockFetch.mockResolvedValue(
      geminiOk('```json\n{"answer":"fenced","count":1}\n```')
    );

    const result = await callWithSchema('prompt', TestSchema, fallback);

    expect(result.data.answer).toBe('fenced');
    expect(result.usedFallback).toBe(false);
  });
});

describe('callWithSchema — retries', () => {
  it('recovers from malformed JSON and reports the failure back to the model', async () => {
    mockFetch
      .mockResolvedValueOnce(geminiOk('{"answer": "oops",'))
      .mockResolvedValueOnce(geminiOk(JSON.stringify({ answer: 'okay', count: 1 })));

    const result = await callWithSchema('base prompt', TestSchema, fallback);

    expect(result.attempts).toBe(2);
    expect(result.usedFallback).toBe(false);
    expect(promptFor(0)).toBe('base prompt');
    expect(promptFor(1)).toContain(CORRECTION_HEADER);
    expect(promptFor(1)).toContain('not valid JSON');
  });

  it('re-prompts with the Zod issue when the response is schema-invalid', async () => {
    mockFetch
      .mockResolvedValueOnce(geminiOk(JSON.stringify({ answer: 'okay', count: 'two' })))
      .mockResolvedValueOnce(geminiOk(JSON.stringify({ answer: 'okay', count: 2 })));

    const result = await callWithSchema('base prompt', TestSchema, fallback);

    expect(result.attempts).toBe(2);
    expect(promptFor(1)).toContain('Schema validation failed');
    expect(promptFor(1)).toContain('count');
  });

  it('rejects unknown keys, since the schema is strict', async () => {
    mockFetch
      .mockResolvedValueOnce(
        geminiOk(JSON.stringify({ answer: 'okay', count: 1, extra: true }))
      )
      .mockResolvedValueOnce(geminiOk(JSON.stringify({ answer: 'okay', count: 1 })));

    const result = await callWithSchema('base prompt', TestSchema, fallback);

    expect(result.attempts).toBe(2);
    expect(result.usedFallback).toBe(false);
  });

  it('retries a non-200 response', async () => {
    mockFetch
      .mockResolvedValueOnce(geminiError(429))
      .mockResolvedValueOnce(geminiOk(JSON.stringify({ answer: 'okay', count: 1 })));

    const result = await callWithSchema('prompt', TestSchema, fallback);

    expect(result.attempts).toBe(2);
    expect(promptFor(1)).toContain('429');
  });

  it('retries an empty completion', async () => {
    mockFetch
      .mockResolvedValueOnce(geminiOk('   '))
      .mockResolvedValueOnce(geminiOk(JSON.stringify({ answer: 'okay', count: 1 })));

    expect((await callWithSchema('prompt', TestSchema, fallback)).attempts).toBe(2);
  });
});

describe('callWithSchema — exhausted retries', () => {
  it('stops after three attempts and returns the fallback', async () => {
    mockFetch.mockResolvedValue(geminiOk('not json at all'));

    const result = await callWithSchema('prompt', TestSchema, fallback);

    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(result.attempts).toBe(3);
    expect(result.usedFallback).toBe(true);
    expect(result.data).toEqual(fallback);
    expect(result.error).toBeDefined();
  });

  it('honours a custom maxAttempts', async () => {
    mockFetch.mockResolvedValue(geminiOk('not json at all'));

    const result = await callWithSchema('prompt', TestSchema, fallback, {
      maxAttempts: 2,
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result.attempts).toBe(2);
  });

  it('falls back when the network throws', async () => {
    mockFetch.mockRejectedValue(new Error('fetch failed'));

    const result = await callWithSchema('prompt', TestSchema, fallback);

    expect(result.usedFallback).toBe(true);
    expect(result.error).toContain('fetch failed');
  });

  it('returns a fallback that is itself schema-valid', async () => {
    mockFetch.mockResolvedValue(geminiOk('not json at all'));

    const result = await callWithSchema('prompt', TestSchema, fallback);

    expect(TestSchema.safeParse(result.data).success).toBe(true);
  });

  it('still returns an invalid fallback rather than throwing, and logs it', async () => {
    mockFetch.mockResolvedValue(geminiOk('not json at all'));
    const broken = { answer: 'x', count: 0 } as TestShape; // answer is too short

    const result = await callWithSchema('prompt', TestSchema, broken);

    expect(result.data).toEqual(broken);
    expect(result.usedFallback).toBe(true);
    expect(console.error).toHaveBeenCalled();
  });
});

describe('callWithSchema — timeout', () => {
  it('aborts a hanging request and falls back', async () => {
    mockFetch.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => {
            const err = new Error('The operation was aborted.');
            err.name = 'AbortError';
            reject(err);
          });
        })
    );

    jest.useFakeTimers();

    const pending = callWithSchema('prompt', TestSchema, fallback, {
      maxAttempts: 1,
      timeoutMs: 1000,
    });

    await jest.advanceTimersByTimeAsync(1000);
    const result = await pending;

    expect(result.usedFallback).toBe(true);
    expect(result.error).toContain('timed out after 1000ms');
    expect(result.data).toEqual(fallback);
  });
});
