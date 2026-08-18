"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { ProfileForm, type ProfileFormData } from "@/components/ProfileForm";
import {
  getDemoProfile,
  getDemoUserId,
  getParsedResume,
  saveDemoProfile,
} from "@/lib/demo-store";
import type { ParsedResume, UserProfile } from "@/types";

export default function ProfilePage() {
  const router = useRouter();
  const [initialData, setInitialData] = useState<ParsedResume | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const profile = getDemoProfile();
    const parsed = getParsedResume();

    if (profile) {
      setInitialData({
        name: profile.name,
        email: "",
        phone: "",
        location: profile.location,
        skills: profile.skills,
        experience: [],
        education: [],
        github_url: profile.github_url,
        portfolio_url: profile.portfolio_url,
        work_authorization: profile.work_auth,
      });
    } else if (parsed) {
      setInitialData(parsed);
    }
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
      xp: getDemoProfile()?.xp || 0,
      rank: getDemoProfile()?.rank || "Bronze",
      streak: getDemoProfile()?.streak || 1,
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

    const matchRes = await fetch("/api/match-jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, profile }),
    });

    if (matchRes.ok) {
      const { matches, skillGaps } = await matchRes.json();
      const { saveDemoMatches } = await import("@/lib/demo-store");
      saveDemoMatches(matches);
      if (skillGaps)
        sessionStorage.setItem("cp_skill_gaps", JSON.stringify(skillGaps));
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
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Edit Profile</h1>
          <p className="mt-1 text-muted">
            Update your skills and preferences to improve match quality
          </p>
        </div>
        <ProfileForm
          initialData={initialData}
          onSubmit={handleSubmit}
          submitLabel="Save & refresh matches →"
          showProgress={false}
        />
      </main>
    </div>
  );
}
