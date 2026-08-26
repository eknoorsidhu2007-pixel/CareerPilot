import { NextRequest } from 'next/server';
import type { Job, UserProfile } from '@/types';

jest.mock('@/lib/supabase', () => ({
  createSupabaseServer: jest.fn(),
}));

jest.mock('@/lib/matcher', () => ({
  rankJobsForProfile: jest.fn(),
  analyzeSkillGaps: jest.fn(),
}));

jest.mock('@/lib/scraper', () => ({
  scrapeAllSources: jest.fn(),
  scrapedToJob: jest.fn(),
}));

import { POST } from '../route';
import { createSupabaseServer } from '@/lib/supabase';
import { analyzeSkillGaps, rankJobsForProfile } from '@/lib/matcher';
import { scrapeAllSources, scrapedToJob } from '@/lib/scraper';

const mockCreateSupabase = createSupabaseServer as jest.Mock;
const mockRank = rankJobsForProfile as jest.Mock;
const mockGaps = analyzeSkillGaps as jest.Mock;
const mockScrape = scrapeAllSources as jest.Mock;
const mockScrapedToJob = scrapedToJob as jest.Mock;

const profile = {
  user_id: 'demo-user',
  name: 'Test User',
  location: 'Toronto, ON',
  skills: ['React', 'TypeScript'],
  github_url: '',
  portfolio_url: '',
  work_auth: '',
  preferences: {
    remote: 'any',
    location: 'Toronto',
    industries: [],
    salary_min: 0,
    salary_max: 200000,
  },
  xp: 0,
  rank: 'Bronze',
  streak: 0,
  last_active: '',
} as UserProfile;

function makeJob(id: string): Job {
  return {
    id,
    title: 'Software Engineer',
    company: 'Acme',
    location: 'Toronto, ON',
    remote: 'Remote',
    description: '',
    skills_required: ['React'],
    salary_range: null,
    url: `https://example.com/${id}`,
    source: 'seed',
    posted_date: '2026-01-01T00:00:00.000Z',
    scraped_at: '2026-01-01T00:00:00.000Z',
  };
}

function buildRequest(body: unknown) {
  return new NextRequest('http://localhost:3000/api/match-jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** Minimal chainable stand-in for the Supabase client used by this route. */
function makeSupabaseStub(jobs: Job[]) {
  const upsert = jest.fn().mockResolvedValue({ data: null, error: null });
  const client = {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        order: jest.fn(() => ({
          limit: jest.fn().mockResolvedValue({ data: jobs, error: null }),
        })),
      })),
      upsert,
    })),
  };
  return { client, upsert };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCreateSupabase.mockReturnValue(null);
  mockScrape.mockResolvedValue([]);
  mockScrapedToJob.mockImplementation((_input: unknown, id: string) => makeJob(id));
  mockRank.mockReturnValue([]);
  mockGaps.mockReturnValue([]);
});

describe('POST /api/match-jobs - validation', () => {
  let errorSpy: jest.SpyInstance;

  beforeAll(() => {
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(() => {
    errorSpy.mockRestore();
  });

  it('returns 400 when the profile is missing', async () => {
    const res = await POST(buildRequest({}));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toHaveProperty('error');
    expect(mockRank).not.toHaveBeenCalled();
  });

  it('returns 400 when the profile has no skills array', async () => {
    const res = await POST(buildRequest({ profile: { name: 'No Skills' } }));

    expect(res.status).toBe(400);
    expect(mockRank).not.toHaveBeenCalled();
  });

  it('returns 500 when the request body is not valid JSON', async () => {
    const req = new NextRequest('http://localhost:3000/api/match-jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json at all',
    });

    expect((await POST(req)).status).toBe(500);
  });
});

describe('POST /api/match-jobs - demo mode (no Supabase)', () => {
  it('scrapes live sources and returns ranked matches', async () => {
    mockScrape.mockResolvedValue([{ url: 'https://example.com/a' }]);
    mockRank.mockReturnValue([
      { job: makeJob('job_1'), score: 92, matchingSkills: ['React'], missingSkills: [] },
      { job: makeJob('job_2'), score: 71, matchingSkills: ['React'], missingSkills: ['Go'] },
    ]);
    mockGaps.mockReturnValue([{ skill: 'Go', rolesUnlocked: 1, priority: 'high' }]);

    const res = await POST(buildRequest({ profile, userId: 'demo-user' }));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(mockScrape).toHaveBeenCalled();
    expect(json.matches).toHaveLength(2);
    expect(json.skillGaps).toHaveLength(1);
  });

  it('returns matches sorted descending by score', async () => {
    mockRank.mockReturnValue([
      { job: makeJob('job_1'), score: 92, matchingSkills: [], missingSkills: [] },
      { job: makeJob('job_2'), score: 71, matchingSkills: [], missingSkills: [] },
      { job: makeJob('job_3'), score: 40, matchingSkills: [], missingSkills: [] },
    ]);

    const { matches } = await (await POST(buildRequest({ profile }))).json();

    for (let i = 1; i < matches.length; i++) {
      expect(matches[i - 1].score).toBeGreaterThanOrEqual(matches[i].score);
    }
  });

  it('shapes each match with an id, job_id, score and skill breakdown', async () => {
    mockRank.mockReturnValue([
      {
        job: makeJob('job_1'),
        score: 92,
        matchingSkills: ['React'],
        missingSkills: ['Go'],
        explanation: 'You match 92% ...',
      },
    ]);

    const { matches } = await (await POST(buildRequest({ profile }))).json();

    expect(matches[0]).toMatchObject({
      job_id: 'job_1',
      score: 92,
      matchingSkills: ['React'],
      missingSkills: ['Go'],
      explanation: 'You match 92% ...',
    });
    expect(matches[0].id).toEqual(expect.any(String));
    expect(matches[0].job).toMatchObject({ id: 'job_1' });
  });

  it('defaults userId to demo-user when none is supplied', async () => {
    mockRank.mockReturnValue([
      { job: makeJob('job_1'), score: 50, matchingSkills: [], missingSkills: [] },
    ]);

    const { matches } = await (await POST(buildRequest({ profile }))).json();

    expect(matches[0].user_id).toBe('demo-user');
  });

  it('returns an empty match list rather than erroring when nothing ranks', async () => {
    const res = await POST(buildRequest({ profile }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ matches: [], skillGaps: [] });
  });
});

describe('POST /api/match-jobs - with Supabase', () => {
  it('uses cached jobs and skips scraping when enough rows exist', async () => {
    const cached = Array.from({ length: 12 }, (_, i) => makeJob(`cached_${i}`));
    const { client } = makeSupabaseStub(cached);
    mockCreateSupabase.mockReturnValue(client);

    await POST(buildRequest({ profile, userId: 'demo-user' }));

    expect(mockScrape).not.toHaveBeenCalled();
    expect(mockRank).toHaveBeenCalledWith(profile, cached, 50);
  });

  it('backfills by scraping when the jobs table is nearly empty', async () => {
    const { client } = makeSupabaseStub([makeJob('only_one')]);
    mockCreateSupabase.mockReturnValue(client);
    mockScrape.mockResolvedValue([{ url: 'https://example.com/new' }]);

    await POST(buildRequest({ profile, userId: 'demo-user' }));

    expect(mockScrape).toHaveBeenCalled();
  });

  it('does not persist matches for a demo user', async () => {
    const { client, upsert } = makeSupabaseStub(
      Array.from({ length: 12 }, (_, i) => makeJob(`cached_${i}`)),
    );
    mockCreateSupabase.mockReturnValue(client);
    mockRank.mockReturnValue([
      { job: makeJob('job_1'), score: 90, matchingSkills: [], missingSkills: [] },
    ]);

    await POST(buildRequest({ profile, userId: 'demo-user' }));

    expect(upsert).not.toHaveBeenCalled();
  });

  it('persists matches for a signed-in user, keyed on user_id and job_id', async () => {
    const { client, upsert } = makeSupabaseStub(
      Array.from({ length: 12 }, (_, i) => makeJob(`cached_${i}`)),
    );
    mockCreateSupabase.mockReturnValue(client);
    mockRank.mockReturnValue([
      { job: makeJob('job_1'), score: 90, matchingSkills: [], missingSkills: [], explanation: 'ok' },
    ]);

    await POST(buildRequest({ profile, userId: 'user_abc' }));

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user_abc', job_id: 'job_1', score: 90 }),
      { onConflict: 'user_id,job_id' },
    );
  });
});

describe('POST /api/match-jobs - failure handling', () => {
  // The route logs via console.error on the 500 path; silence it so the
  // expected failures don't look like real errors in test output.
  let errorSpy: jest.SpyInstance;

  beforeAll(() => {
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(() => {
    errorSpy.mockRestore();
  });

  it('returns 500 when the matcher throws', async () => {
    mockRank.mockImplementation(() => {
      throw new Error('engine failure');
    });

    const res = await POST(buildRequest({ profile }));

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toHaveProperty('error');
  });

  it('returns 500 when scraping rejects', async () => {
    mockScrape.mockRejectedValue(new Error('network down'));

    expect((await POST(buildRequest({ profile }))).status).toBe(500);
  });

  it('does not leak the internal error message to the client', async () => {
    mockRank.mockImplementation(() => {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is invalid');
    });

    const { error } = await (await POST(buildRequest({ profile }))).json();

    expect(error).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
  });
});
