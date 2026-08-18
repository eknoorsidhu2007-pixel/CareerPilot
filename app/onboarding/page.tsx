"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { ProfileForm, type ProfileFormData } from "@/components/ProfileForm";
import {
  getDemoUserId,
  getParsedResume,
  saveDemoProfile,
} from "@/lib/demo-store";
import type { ParsedResume, UserProfile } from "@/types";

export default function OnboardingPage() {
  const router = useRouter();
  const [parsed, setParsed] = useState<ParsedResume | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const data = getParsedResume();
    setParsed(data);
    setLoading(false);
  }, []);

  const handleSubmit = async (data: ProfileFormData) => {
    const userId = getDemoUserId();
    const profile: UserProfile = {
      user_id: userId,
      name: data.name,
      location: data.location,
      skills: data.skills,
      github_url: data.github_url,
      portfolio_url: "",
      work_auth: "",
      preferences: data.preferences,
      xp: 100,
      rank: "Bronze",
      streak: 1,
      last_active: new Date().toISOString().split("T")[0],
    };

    saveDemoProfile(profile);

    await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        profile,
        experiences: data.experience,
        education: data.education,
      }),
    });

    await fetch("/api/xp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, eventType: "complete_profile" }),
    });

    const matchRes = await fetch("/api/match-jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, profile }),
    });

    if (matchRes.ok) {
      const { matches, skillGaps } = await matchRes.json();
      const { saveDemoMatches } = await import("@/lib/demo-store");
      saveDemoMatches(matches);
      if (skillGaps) sessionStorage.setItem("cp_skill_gaps", JSON.stringify(skillGaps));
    }

    router.push("/dashboard");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-blue" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg">
      <Navbar />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <ProfileForm
          initialData={parsed}
          onSubmit={handleSubmit}
          submitLabel="Find my matches →"
          progressStep={2}
        />
      </main>
    </div>
  );
}
