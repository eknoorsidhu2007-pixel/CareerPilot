import {
  JOB_CONFLICT_TARGET,
  JOB_UPSERT_CHUNK_SIZE,
  chunk,
  toJobRow,
} from '@/lib/jobs';
import type { ScrapedJobInput } from '@/lib/scraper';

const SCRAPED: ScrapedJobInput = {
  title: 'Software Engineer Intern',
  company: 'Acme',
  location: 'Toronto, ON',
  remote: 'Remote',
  description: 'Build things.',
  skills_required: ['React'],
  salary_range: '$45/hr - $65/hr',
  job_url: 'https://example.com/job/1',
  source: 'seed',
  posted_date: '2026-01-01T00:00:00.000Z',
  applicant_count: 42,
};

describe('chunk', () => {
  it('splits evenly when the length is a multiple of the size', () => {
    expect(chunk([1, 2, 3, 4], 2)).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  it('leaves a short final batch', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('returns no batches for an empty list', () => {
    expect(chunk([], 500)).toEqual([]);
  });

  it('returns a single batch when the list is smaller than the size', () => {
    expect(chunk([1, 2], 500)).toEqual([[1, 2]]);
  });

  it('rejects a size below one rather than looping forever', () => {
    expect(() => chunk([1, 2], 0)).toThrow();
    expect(() => chunk([1, 2], -1)).toThrow();
  });

  it('preserves every element across batches', () => {
    const items = Array.from({ length: 1234 }, (_, i) => i);
    const flat = chunk(items, JOB_UPSERT_CHUNK_SIZE).flat();

    expect(flat).toEqual(items);
    expect(chunk(items, JOB_UPSERT_CHUNK_SIZE)).toHaveLength(3);
  });
});

describe('toJobRow', () => {
  it('maps a scraped job onto the jobs column set', () => {
    const row = toJobRow(SCRAPED, '2026-06-01T00:00:00.000Z');

    expect(row).toEqual({
      title: 'Software Engineer Intern',
      company: 'Acme',
      location: 'Toronto, ON',
      remote: 'Remote',
      description: 'Build things.',
      skills_required: ['React'],
      salary_range: '$45/hr - $65/hr',
      job_url: 'https://example.com/job/1',
      source: 'seed',
      posted_date: '2026-01-01T00:00:00.000Z',
      applicant_count: 42,
      scraped_at: '2026-06-01T00:00:00.000Z',
    });
  });

  it('emits job_url, never the old url column name', () => {
    const row = toJobRow(SCRAPED);

    expect(row).toHaveProperty('job_url');
    expect(row).not.toHaveProperty('url');
  });

  it('defaults scraped_at to now', () => {
    const before = Date.now();
    const row = toJobRow(SCRAPED);

    expect(new Date(row.scraped_at).getTime()).toBeGreaterThanOrEqual(before);
  });

  it('shares one timestamp across a batch when passed explicitly', () => {
    const at = '2026-06-01T00:00:00.000Z';
    const rows = [SCRAPED, SCRAPED].map((j) => toJobRow(j, at));

    expect(new Set(rows.map((r) => r.scraped_at)).size).toBe(1);
  });

  it('does not invent an id - the database assigns it', () => {
    expect(toJobRow(SCRAPED)).not.toHaveProperty('id');
  });
});

describe('constants', () => {
  it('targets job_url for conflict resolution', () => {
    expect(JOB_CONFLICT_TARGET).toBe('job_url');
  });

  it('uses a batch size that keeps payloads reasonable', () => {
    expect(JOB_UPSERT_CHUNK_SIZE).toBe(500);
  });
});
