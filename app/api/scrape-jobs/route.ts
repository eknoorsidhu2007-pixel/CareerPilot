import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase";
import { scrapeAllSources } from "@/lib/scraper";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    const isVercelCron = req.headers.get("x-vercel-cron") === "1";
    if (!isVercelCron) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
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

    let inserted = 0;
    for (const job of scraped) {
      const { error } = await supabase.from("jobs").upsert(
        {
          title: job.title,
          company: job.company,
          location: job.location,
          remote: job.remote,
          description: job.description,
          skills_required: job.skills_required,
          salary_range: job.salary_range,
          url: job.url,
          source: job.source,
          posted_date: job.posted_date,
          applicant_count: job.applicant_count,
          scraped_at: new Date().toISOString(),
        },
        { onConflict: "url" }
      );
      if (!error) inserted++;
    }

    await supabase.from("scrape_runs").insert({
      source: "all",
      jobs_found: inserted,
    });

    return NextResponse.json({
      success: true,
      jobsFound: scraped.length,
      jobsInserted: inserted,
    });
  } catch (error) {
    console.error("Scrape error:", error);
    return NextResponse.json(
      { error: "Scrape failed" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
