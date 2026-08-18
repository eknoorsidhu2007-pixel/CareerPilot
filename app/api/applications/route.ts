import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createSupabaseServer } from "@/lib/supabase";
import type { ApplicationStatus } from "@/types";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const supabase = createSupabaseServer();
  if (!supabase || userId.startsWith("demo-")) {
    return NextResponse.json({ applications: [] });
  }

  const { data } = await supabase
    .from("applications")
    .select("*, jobs(*)")
    .eq("user_id", userId);

  const applications = (data || []).map((a: Record<string, unknown>) => ({
    ...a,
    job: a.jobs,
  }));

  return NextResponse.json({ applications });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, jobId, status, notes, job } = body;

    const supabase = createSupabaseServer();
    if (!supabase || userId?.startsWith("demo-")) {
      return NextResponse.json({
        application: {
          id: randomUUID(),
          user_id: userId,
          job_id: jobId,
          status: status || "saved",
          notes: notes || "",
          job,
        },
        demo: true,
      });
    }

    const { data, error } = await supabase
      .from("applications")
      .upsert(
        {
          user_id: userId,
          job_id: jobId,
          status: status || "saved",
          notes: notes || "",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,job_id" }
      )
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ application: data });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, status, notes } = (await req.json()) as {
      id: string;
      status?: ApplicationStatus;
      notes?: string;
    };

    const supabase = createSupabaseServer();
    if (!supabase) {
      return NextResponse.json({ success: true, demo: true });
    }

    const updates: Record<string, string> = {
      updated_at: new Date().toISOString(),
    };
    if (status) updates.status = status;
    if (notes !== undefined) updates.notes = notes;

    await supabase.from("applications").update(updates).eq("id", id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
