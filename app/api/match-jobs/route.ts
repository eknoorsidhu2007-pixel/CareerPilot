import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createSupabaseServer } from "@/lib/supabase";
import { rankJobsForProfile, analyzeSkillGaps } from "@/lib/matcher";
import { enrichMatchExplanations } from "@/lib/matcher-llm";
import { scrapeAllSources, scrapedToJob } from "@/lib/scraper";
import { JOB_CONFLICT_TARGET, toJobRow } from "@/lib/jobs";
import type { Job, UserProfile } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const profile: UserProfile = body.profile;
    const userId: string = body.userId || "demo-user";

    if (!profile || !profile.skills) {
      return NextResponse.json({ error: "Profile required" }, { status: 400 });
    }

    const supabase = createSupabaseServer();
    let jobs: Job[] = [];

    if (supabase) {
      const { data } = await supabase
        .from("jobs")
        .select("*")
        .order("scraped_at", { ascending: false })
        .limit(200);

      jobs = (data || []) as Job[];

      if (jobs.length < 10) {
        const scraped = await scrapeAllSources();
        const scrapedAt = new Date().toISOString();

        // One batched statement, duplicates skipped at the database.
        await supabase
          .from("jobs")
          .upsert(
            scraped.slice(0, 50).map((s) => toJobRow(s, scrapedAt)),
            { onConflict: JOB_CONFLICT_TARGET, ignoreDuplicates: true }
          );

        const { data: refreshed } = await supabase
          .from("jobs")
          .select("*")
          .order("scraped_at", { ascending: false })
          .limit(200);

        jobs = (refreshed?.length ? refreshed : scraped.map((s) => scrapedToJob(s, randomUUID()))) as Job[];
      }
    } else {
      const scraped = await scrapeAllSources();
      jobs = scraped.map((s) => scrapedToJob(s, randomUUID()));
    }

    const ranked = await rankJobsForProfile(profile, jobs, 50);
    const skillGaps = analyzeSkillGaps(profile, jobs);

    // Deterministic ranking first; the LLM only rewrites the top explanations
    // and silently keeps the template ones when it is unavailable.
    const explained = await enrichMatchExplanations(ranked, profile);

    const matches = explained.map((m) => ({
      id: randomUUID(),
      user_id: userId,
      job_id: m.job.id,
      score: m.score,
      explanation: m.explanation || "",
      job: m.job,
      matchingSkills: m.matchingSkills,
      missingSkills: m.missingSkills,
    }));

    if (supabase && userId !== "demo-user") {
      for (const match of matches) {
        await supabase.from("matches").upsert(
          {
            user_id: userId,
            job_id: match.job_id,
            score: match.score,
            explanation: match.explanation,
          },
          { onConflict: "user_id,job_id" }
        );
      }
    }

    return NextResponse.json({ matches, skillGaps });
  } catch (error) {
    console.error("Match error:", error);
    return NextResponse.json(
      { error: "Matching failed" },
      { status: 500 }
    );
  }
}