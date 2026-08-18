import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createSupabaseServer } from "@/lib/supabase";
import { rankJobsForProfile, analyzeSkillGaps } from "@/lib/matcher";
import { scrapeAllSources, scrapedToJob } from "@/lib/scraper";
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
        for (const s of scraped.slice(0, 50)) {
          const id = randomUUID();
          await supabase.from("jobs").upsert(
            {
              id,
              title: s.title,
              company: s.company,
              location: s.location,
              remote: s.remote,
              description: s.description,
              skills_required: s.skills_required,
              salary_range: s.salary_range,
              url: s.url,
              source: s.source,
              posted_date: s.posted_date,
              applicant_count: s.applicant_count,
            },
            { onConflict: "url" }
          );
          jobs.push(scrapedToJob(s, id));
        }
      }
    } else {
      const scraped = await scrapeAllSources();
      jobs = scraped.map((s) => scrapedToJob(s, randomUUID()));
    }

    const ranked = rankJobsForProfile(profile, jobs, 50);
    const skillGaps = analyzeSkillGaps(profile, jobs);

    const matches = ranked.map((m) => ({
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
