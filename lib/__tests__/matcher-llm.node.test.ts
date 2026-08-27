import { generateMatchExplanation, type ScoredMatch } from '@/lib/matcher';
import {
  MatchExplanationSchema,
  buildMatchExplanationPrompt,
  deterministicExplanation,
  enrichMatchExplanations,
  explainMatchWithLlm,
} from '@/lib/matcher-llm';
import type { Job, UserProfile, WorkPreferences } from '@/types';

const prefs: WorkPreferences = {
  remote: 'any',
  location: 'Toronto',
  industries: [],
  salary_min: 0,
  salary_max: 200000,
};

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: 'job-1',
    title: 'Frontend Developer Intern',
    company: 'Acme',
    location: 'Toronto, ON',
    remote: 'Remote',
    description: 'Build UI with React and TypeScript.',
    skills_required: ['React', 'TypeScript'],
    salary_range: null,
    job_url: 'https://example.com/job-1',
    source: 'test',
    posted_date: '2026-01-01',
    scraped_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    user_id: 'demo-user',
    name: 'Test User',
    location: 'Toronto, ON',
    skills: ['React', 'TypeScript'],
    github_url: '',
    portfolio_url: '',
    work_auth: '',
    preferences: prefs,
    xp: 0,
    rank: 'Bronze',
    streak: 0,
    last_active: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeMatch(index: number): ScoredMatch {
  const job = makeJob({ id: `job-${index}`, title: `Role ${index}` });
  return {
    job,
    score: 70 - index,
    matchingSkills: ['React'],
    missingSkills: ['Go'],
    explanation: generateMatchExplanation(70 - index, job, ['React'], ['Go'], prefs),
  };
}

const mockFetch = jest.fn();

function geminiOk(payload: unknown) {
  const text = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }),
    text: async () => text,
  } as unknown as Response;
}

function llmExplanation(text: string) {
  return geminiOk({ explanation: text, strengths: ['React'], improvement: 'Go' });
}

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = mockFetch as unknown as typeof fetch;
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
  delete process.env.GEMINI_API_KEY;
});

describe('deterministicExplanation', () => {
  it('produces schema-valid output for a normal match', () => {
    const result = deterministicExplanation(72, makeJob(), ['React', 'TypeScript'], ['Go'], prefs);
    expect(MatchExplanationSchema.safeParse(result).success).toBe(true);
  });

  it('produces schema-valid output when nothing matches', () => {
    const result = deterministicExplanation(0, makeJob(), [], [], prefs);
    expect(MatchExplanationSchema.safeParse(result).success).toBe(true);
    expect(result.strengths).toEqual([]);
    expect(result.improvement).toBeNull();
  });

  it('caps an over-long explanation at the schema limit', () => {
    const skills = Array.from({ length: 5 }, () => 'X'.repeat(120));
    const result = deterministicExplanation(30, makeJob(), skills, skills, prefs);
    expect(result.explanation.length).toBeLessThanOrEqual(400);
    expect(MatchExplanationSchema.safeParse(result).success).toBe(true);
  });

  it('keeps at most three strengths', () => {
    const result = deterministicExplanation(
      80,
      makeJob(),
      ['React', 'TypeScript', 'Node.js', 'Python'],
      [],
      prefs
    );
    expect(result.strengths).toHaveLength(3);
  });

  it('reuses the existing template verbatim', () => {
    const job = makeJob();
    const result = deterministicExplanation(72, job, ['React'], ['Go'], prefs);
    expect(result.explanation).toBe(
      generateMatchExplanation(72, job, ['React'], ['Go'], prefs)
    );
  });
});

describe('buildMatchExplanationPrompt', () => {
  it('includes the score, role and both skill lists', () => {
    const prompt = buildMatchExplanationPrompt(72, makeJob(), ['React'], ['Go'], prefs);
    expect(prompt).toContain('72%');
    expect(prompt).toContain('Frontend Developer Intern');
    expect(prompt).toContain('Matching skills: React');
    expect(prompt).toContain('Missing skills: Go');
  });

  it('renders empty skill lists as "none"', () => {
    const prompt = buildMatchExplanationPrompt(10, makeJob(), [], [], prefs);
    expect(prompt).toContain('Matching skills: none');
  });
});

describe('explainMatchWithLlm', () => {
  it('returns the template output when no API key is configured', async () => {
    const job = makeJob();
    const result = await explainMatchWithLlm(72, job, ['React'], ['Go'], prefs);

    expect(result.usedFallback).toBe(true);
    expect(result.attempts).toBe(0);
    expect(result.data.explanation).toBe(
      generateMatchExplanation(72, job, ['React'], ['Go'], prefs)
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns the model explanation when the response validates', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    mockFetch.mockResolvedValue(llmExplanation('You are a strong fit for this internship.'));

    const result = await explainMatchWithLlm(72, makeJob(), ['React'], ['Go'], prefs);

    expect(result.usedFallback).toBe(false);
    expect(result.data.explanation).toBe('You are a strong fit for this internship.');
  });

  it('rejects an explanation that is too long and falls back', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    mockFetch.mockResolvedValue(llmExplanation('word '.repeat(200)));

    const result = await explainMatchWithLlm(72, makeJob(), ['React'], ['Go'], prefs);

    expect(result.usedFallback).toBe(true);
    expect(MatchExplanationSchema.safeParse(result.data).success).toBe(true);
  });
});

describe('enrichMatchExplanations', () => {
  it('returns the input untouched with no API key and makes no request', async () => {
    const matches = [makeMatch(0), makeMatch(1)];

    const result = await enrichMatchExplanations(matches, makeProfile());

    expect(result).toBe(matches);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('handles an empty match list', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    expect(await enrichMatchExplanations([], makeProfile())).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('rewrites the explanation on the top matches', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    mockFetch.mockResolvedValue(llmExplanation('An LLM written explanation.'));
    const matches = [makeMatch(0), makeMatch(1)];

    const result = await enrichMatchExplanations(matches, makeProfile());

    expect(result[0].explanation).toBe('An LLM written explanation.');
    expect(result[1].explanation).toBe('An LLM written explanation.');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('leaves score, job and skills untouched', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    mockFetch.mockResolvedValue(llmExplanation('An LLM written explanation.'));
    const matches = [makeMatch(0)];

    const [result] = await enrichMatchExplanations(matches, makeProfile());

    expect(result.score).toBe(matches[0].score);
    expect(result.job).toBe(matches[0].job);
    expect(result.matchingSkills).toEqual(matches[0].matchingSkills);
  });

  it('respects the limit option', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    mockFetch.mockResolvedValue(llmExplanation('An LLM written explanation.'));
    const matches = [makeMatch(0), makeMatch(1), makeMatch(2), makeMatch(3)];

    const result = await enrichMatchExplanations(matches, makeProfile(), { limit: 2 });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result[2].explanation).toBe(matches[2].explanation);
  });

  it('enriches at most five matches by default', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    mockFetch.mockResolvedValue(llmExplanation('An LLM written explanation.'));
    const matches = Array.from({ length: 8 }, (_, i) => makeMatch(i));

    const result = await enrichMatchExplanations(matches, makeProfile());

    expect(mockFetch).toHaveBeenCalledTimes(5);
    expect(result[5].explanation).toBe(matches[5].explanation);
  });

  it('opens the circuit after the probe fails, sparing the remaining matches', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    mockFetch.mockResolvedValue(geminiOk('not json at all'));
    const matches = [makeMatch(0), makeMatch(1), makeMatch(2)];

    const result = await enrichMatchExplanations(matches, makeProfile());

    // Three attempts on the probe only, none on matches 2 and 3.
    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(result).toBe(matches);
  });

  it('keeps the template explanation on an individual failure after the probe', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    mockFetch
      .mockResolvedValueOnce(llmExplanation('An LLM written explanation.'))
      .mockResolvedValue(geminiOk('not json at all'));
    const matches = [makeMatch(0), makeMatch(1)];

    const result = await enrichMatchExplanations(matches, makeProfile(), { limit: 2 });

    expect(result[0].explanation).toBe('An LLM written explanation.');
    expect(result[1].explanation).toBe(matches[1].explanation);
  });

  it('tolerates a profile with no preferences', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    mockFetch.mockResolvedValue(llmExplanation('An LLM written explanation.'));
    const profile = makeProfile({ preferences: undefined as unknown as WorkPreferences });

    const result = await enrichMatchExplanations([makeMatch(0)], profile);

    expect(result[0].explanation).toBe('An LLM written explanation.');
  });
});
