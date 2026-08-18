import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase";
import { getXpForEvent } from "@/lib/gamification";
import { getRankFromXp } from "@/lib/utils";
import type { XpEventType } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const { userId, eventType } = (await req.json()) as {
      userId: string;
      eventType: XpEventType;
    };

    if (!userId || !eventType) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const xpGained = getXpForEvent(eventType);
    const supabase = createSupabaseServer();

    if (!supabase) {
      return NextResponse.json({
        xpGained,
        totalXp: xpGained,
        rank: "Bronze",
        demo: true,
      });
    }

    await supabase.from("xp_events").insert({
      user_id: userId,
      event_type: eventType,
      xp_gained: xpGained,
    });

    const { data: profile } = await supabase
      .from("profiles")
      .select("xp")
      .eq("user_id", userId)
      .single();

    const newXp = (profile?.xp || 0) + xpGained;
    const rank = getRankFromXp(newXp).tier;

    await supabase
      .from("profiles")
      .update({ xp: newXp, rank, last_active: new Date().toISOString().split("T")[0] })
      .eq("user_id", userId);

    return NextResponse.json({ xpGained, totalXp: newXp, rank });
  } catch {
    return NextResponse.json({ error: "XP update failed" }, { status: 500 });
  }
}
