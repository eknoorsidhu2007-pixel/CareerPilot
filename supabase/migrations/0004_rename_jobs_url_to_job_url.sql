-- 0004 rename public.jobs.url -> job_url and harden the dedup constraint
-- Idempotent: safe to re-run against an existing database.

-- 1. Rename the column, but only if the old name is still present.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'jobs' AND column_name = 'url'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'jobs' AND column_name = 'job_url'
  ) THEN
    ALTER TABLE public.jobs RENAME COLUMN url TO job_url;
  END IF;
END $$;

-- 2. Renaming a column does not rename its constraint, so do that explicitly.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'jobs_url_key')
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'jobs_job_url_key') THEN
    ALTER TABLE public.jobs RENAME CONSTRAINT jobs_url_key TO jobs_job_url_key;
  END IF;
END $$;

-- 3. A UNIQUE column that allows NULL permits unlimited NULL rows, which is a
--    hole in the deduplication guarantee. Scraped jobs without a URL are
--    unusable anyway, so clear them out and close it.
DELETE FROM public.jobs WHERE job_url IS NULL OR btrim(job_url) = '';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'jobs_job_url_key') THEN
    ALTER TABLE public.jobs ADD CONSTRAINT jobs_job_url_key UNIQUE (job_url);
  END IF;
END $$;

ALTER TABLE public.jobs ALTER COLUMN job_url SET NOT NULL;
