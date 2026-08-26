import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase";
import { scrapeAllSources } from "@/lib/scraper";
import {
  JOB_CONFLICT_TARGET,
  JOB_UPSERT_CHUNK_SIZE,
  chunk,
  toJobRow,
} from "@/lib/jobs";

export const runtime = "nodejs";
export const maxDuration = 300;

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  // Unconfigured means local/demo: nothing to protect.
  if (!cronSecret) return true;
  if (req.headers.get("authorization") === `Bearer ${cronSecret}`) return true;
  return req.headers.get("x-vercel-cron") === "1";
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const scraped = await scrapeAllSources();
    const supabase = createSupabaseServer();

    if (!supabase) {
      return NextResponse.json({
        success: true,
        mode: "demo",
        jobsFound: scraped.length,
        jobs: scraped.slice(0, 10),
      });
    }

    const scrapedAt = new Date().toISOString();
    const rows = scraped.map((job) => toJobRow(job, scrapedAt));
    const batches = chunk(rows, JOB_UPSERT_CHUNK_SIZE);

    let inserted = 0;
    let failed = 0;

    for (const batch of batches) {
      // ignoreDuplicates -> ON CONFLICT DO NOTHING. A job_url already in the
      // table is skipped outright rather than rewritten, so a cron run costs
      // one statement per batch instead of one round-trip per job, and
      // scraped_at keeps meaning "first seen".
      const { data, error } = await supabase
        .from("jobs")
        .upsert(batch, { onConflict: JOB_CONFLICT_TARGET, ignoreDuplicates: true })
        .select("id");

      if (error) {
        console.error("Job upsert batch failed:", error.message);
        failed += batch.length;
      } else {
        inserted += data?.length ?? 0;
      }
    }

    await supabase.from("scrape_runs").insert({
      source: "all",
      jobs_found: inserted,
    });

    return NextResponse.json({
      success: true,
      jobsFound: scraped.length,
      jobsInserted: inserted,
      duplicatesSkipped: Math.max(scraped.length - inserted - failed, 0),
      batches: batches.length,
    });
  } catch (error) {
    console.error("Scrape error:", error);
    return NextResponse.json({ error: "Scrape failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
