import type { ScrapedJobInput } from "./scraper";

/** Rows per upsert statement. Keeps each request payload well under limits. */
export const JOB_UPSERT_CHUNK_SIZE = 500;

/** The conflict target for job deduplication - see supabase/migrations. */
export const JOB_CONFLICT_TARGET = "job_url";

export function chunk<T>(items: T[], size: number): T[][] {
  if (size < 1) throw new Error("chunk size must be at least 1");
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

/** Maps a scraped job onto the public.jobs column set. */
export function toJobRow(
  job: ScrapedJobInput,
  scrapedAt: string = new Date().toISOString()
) {
  return {
    title: job.title,
    company: job.company,
    location: job.location,
    remote: job.remote,
    description: job.description,
    skills_required: job.skills_required,
    salary_range: job.salary_range,
    job_url: job.job_url,
    source: job.source,
    posted_date: job.posted_date,
    applicant_count: job.applicant_count,
    scraped_at: scrapedAt,
  };
}

export type JobRow = ReturnType<typeof toJobRow>;
