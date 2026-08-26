import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase";
import { getRankFromXp } from "@/lib/utils";
import { ProfileUpsertSchema, formatIssues } from "@/lib/schemas";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Validate before touching the database. A malformed payload must never
    // reach an upsert or a delete.
    const parsed = ProfileUpsertSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid profile payload", issues: formatIssues(parsed.error) },
        { status: 400 }
      );
    }

    const { userId, profile, experiences, education } = parsed.data;

    const supabase = createSupabaseServer();
    if (!supabase || userId.startsWith("demo-")) {
      return NextResponse.json({ success: true, demo: true });
    }

    await supabase.from("profiles").upsert({
      user_id: userId,
      name: profile.name,
      location: profile.location,
      skills: profile.skills,
      github_url: profile.github_url,
      preferences: profile.preferences,
      updated_at: new Date().toISOString(),
    });

    await supabase.from("experiences").delete().eq("user_id", userId);
    if (experiences?.length) {
      await supabase.from("experiences").insert(
        experiences.map((e) => ({
          user_id: userId,
          title: e.title,
          company: e.company,
          start_date: e.start_date,
          end_date: e.end_date,
          description: e.description,
        }))
      );
    }

    await supabase.from("education").delete().eq("user_id", userId);
    if (education?.length) {
      await supabase.from("education").insert(
        education.map((e) => ({
          user_id: userId,
          school: e.school,
          degree: e.degree,
          field: e.field,
          start_year: e.start_year,
          end_year: e.end_year,
          gpa: e.gpa,
        }))
      );
    }

    const { data: existing } = await supabase
      .from("profiles")
      .select("xp")
      .eq("user_id", userId)
      .single();

    if (!existing?.xp) {
      const rank = getRankFromXp(100).tier;
      await supabase
        .from("profiles")
        .update({ xp: 100, rank })
        .eq("user_id", userId);
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Save failed" }, { status: 500 });
  }
}
