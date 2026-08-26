import { NextRequest } from 'next/server';
import type { ScrapedJobInput } from '@/lib/scraper';

jest.mock('@/lib/supabase', () => ({ createSupabaseServer: jest.fn() }));
jest.mock('@/lib/scraper', () => ({ scrapeAllSources: jest.fn() }));

import { GET, POST } from '../route';
import { createSupabaseServer } from '@/lib/supabase';
import { scrapeAllSources } from '@/lib/scraper';
import { JOB_UPSERT_CHUNK_SIZE } from '@/lib/jobs';

const mockCreateSupabase = createSupabaseServer as jest.Mock;
const mockScrape = scrapeAllSources as jest.Mock;

const ORIGINAL_CRON_SECRET = process.env.CRON_SECRET;

function makeScraped(n: number): ScrapedJobInput[] {
  return Array.from({ length: n }, (_, i) => ({
    title: `Engineer ${i}`,
    company: 'Acme',
    location: 'Toronto, ON',
    remote: 'Remote',
    description: '',
    skills_required: ['React'],
    salary_range: null,
    job_url: `https://example.com/job/${i}`,
    source: 'seed',
    posted_date: '2026-01-01T00:00:00.000Z',
  }));
}

/**
 * Stand-in for the Supabase client. `insertedPerBatch` controls how many rows
 * each upsert reports back - with ignoreDuplicates that is the count of rows
 * that were genuinely new.
 */
function makeSupabaseStub({
  insertedPerBatch,
  upsertError = null,
}: {
  insertedPerBatch: (batchSize: number, callIndex: number) => number;
  upsertError?: { message: string } | null;
}) {
  let callIndex = 0;
  const upsert = jest.fn((rows: unknown[]) => {
    const index = callIndex++;
    return {
      select: jest.fn().mockResolvedValue(
        upsertError
          ? { data: null, error: upsertError }
          : {
              data: Array.from(
                { length: insertedPerBatch(rows.length, index) },
                (_, i) => ({ id: `id_${index}_${i}` }),
              ),
              error: null,
            },
      ),
    };
  });
  const insert = jest.fn().mockResolvedValue({ data: null, error: null });

  const client = {
    from: jest.fn((table: string) => (table === 'jobs' ? { upsert } : { insert })),
  };

  return { client, upsert, insert };
}

function makeRequest(headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost:3000/api/scrape-jobs', {
    method: 'GET',
    headers,
  });
}

let errorSpy: jest.SpyInstance;

beforeAll(() => {
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
  errorSpy.mockRestore();
  process.env.CRON_SECRET = ORIGINAL_CRON_SECRET;
});

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.CRON_SECRET;
  mockCreateSupabase.mockReturnValue(null);
  mockScrape.mockResolvedValue(makeScraped(3));
});

describe('GET /api/scrape-jobs - authorization', () => {
  it('returns 401 when CRON_SECRET is set and no credentials are sent', async () => {
    process.env.CRON_SECRET = 'topsecret';

    const res = await GET(makeRequest());

    expect(res.status).toBe(401);
    expect(mockScrape).not.toHaveBeenCalled();
  });

  it('returns 401 for a wrong bearer token', async () => {
    process.env.CRON_SECRET = 'topsecret';

    expect((await GET(makeRequest({ authorization: 'Bearer wrong' }))).status).toBe(401);
  });

  it('accepts the correct bearer token', async () => {
    process.env.CRON_SECRET = 'topsecret';

    const res = await GET(makeRequest({ authorization: 'Bearer topsecret' }));

    expect(res.status).toBe(200);
  });

  it('accepts a Vercel cron invocation without a bearer token', async () => {
    process.env.CRON_SECRET = 'topsecret';

    const res = await GET(makeRequest({ 'x-vercel-cron': '1' }));

    expect(res.status).toBe(200);
  });

  it('runs unauthenticated when CRON_SECRET is unset (local/demo)', async () => {
    expect((await GET(makeRequest())).status).toBe(200);
  });
});

describe('GET /api/scrape-jobs - demo mode', () => {
  it('reports demo mode and skips the database when Supabase is unconfigured', async () => {
    const body = await (await GET(makeRequest())).json();

    expect(body.mode).toBe('demo');
    expect(body.jobsFound).toBe(3);
    expect(body).not.toHaveProperty('jobsInserted');
  });
});

describe('GET /api/scrape-jobs - deduplicated batch upsert', () => {
  it('upserts with ignoreDuplicates against the job_url conflict target', async () => {
    const { client, upsert } = makeSupabaseStub({ insertedPerBatch: (n) => n });
    mockCreateSupabase.mockReturnValue(client);

    await GET(makeRequest());

    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert).toHaveBeenCalledWith(expect.any(Array), {
      onConflict: 'job_url',
      ignoreDuplicates: true,
    });
  });

  it('sends one statement per batch rather than one per job', async () => {
    mockScrape.mockResolvedValue(makeScraped(JOB_UPSERT_CHUNK_SIZE + 1));
    const { client, upsert } = makeSupabaseStub({ insertedPerBatch: (n) => n });
    mockCreateSupabase.mockReturnValue(client);

    const body = await (await GET(makeRequest())).json();

    expect(upsert).toHaveBeenCalledTimes(2);
    expect(body.batches).toBe(2);
    expect(upsert.mock.calls[0][0]).toHaveLength(JOB_UPSERT_CHUNK_SIZE);
    expect(upsert.mock.calls[1][0]).toHaveLength(1);
  });

  it('sends rows keyed on job_url', async () => {
    const { client, upsert } = makeSupabaseStub({ insertedPerBatch: (n) => n });
    mockCreateSupabase.mockReturnValue(client);

    await GET(makeRequest());

    const row = (upsert.mock.calls[0][0] as Record<string, unknown>[])[0];
    expect(row).toHaveProperty('job_url');
    expect(row).not.toHaveProperty('url');
  });

  it('counts only genuinely new rows as inserted', async () => {
    const { client } = makeSupabaseStub({ insertedPerBatch: () => 1 });
    mockCreateSupabase.mockReturnValue(client);

    const body = await (await GET(makeRequest())).json();

    expect(body.jobsFound).toBe(3);
    expect(body.jobsInserted).toBe(1);
    expect(body.duplicatesSkipped).toBe(2);
  });

  it('reports every job as a duplicate when nothing is new', async () => {
    const { client } = makeSupabaseStub({ insertedPerBatch: () => 0 });
    mockCreateSupabase.mockReturnValue(client);

    const body = await (await GET(makeRequest())).json();

    expect(body.jobsInserted).toBe(0);
    expect(body.duplicatesSkipped).toBe(3);
  });

  it('records the run in scrape_runs', async () => {
    const { client, insert } = makeSupabaseStub({ insertedPerBatch: () => 2 });
    mockCreateSupabase.mockReturnValue(client);

    await GET(makeRequest());

    expect(insert).toHaveBeenCalledWith({ source: 'all', jobs_found: 2 });
  });

  it('handles an empty scrape without touching the database', async () => {
    mockScrape.mockResolvedValue([]);
    const { client, upsert } = makeSupabaseStub({ insertedPerBatch: () => 0 });
    mockCreateSupabase.mockReturnValue(client);

    const body = await (await GET(makeRequest())).json();

    expect(upsert).not.toHaveBeenCalled();
    expect(body.jobsFound).toBe(0);
    expect(body.batches).toBe(0);
  });
});

describe('GET /api/scrape-jobs - failure handling', () => {
  it('keeps going and does not count a failed batch as inserted', async () => {
    const { client } = makeSupabaseStub({
      insertedPerBatch: () => 0,
      upsertError: { message: 'permission denied for table jobs' },
    });
    mockCreateSupabase.mockReturnValue(client);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.jobsInserted).toBe(0);
    expect(body.duplicatesSkipped).toBe(0);
  });

  it('returns 500 when scraping rejects', async () => {
    mockScrape.mockRejectedValue(new Error('network down'));

    expect((await GET(makeRequest())).status).toBe(500);
  });

  it('does not leak the internal error message', async () => {
    mockScrape.mockRejectedValue(new Error('SUPABASE_SERVICE_ROLE_KEY invalid'));

    const { error } = await (await GET(makeRequest())).json();

    expect(error).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
  });
});

describe('POST /api/scrape-jobs', () => {
  it('delegates to the same handler as GET', async () => {
    const body = await (await POST(makeRequest())).json();

    expect(body.mode).toBe('demo');
    expect(mockScrape).toHaveBeenCalledTimes(1);
  });
});
