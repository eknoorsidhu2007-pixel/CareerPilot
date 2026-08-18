"use client";

import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { ResumeUpload } from "@/components/ResumeUpload";
import { saveParsedResume } from "@/lib/demo-store";
import type { ParsedResume } from "@/types";

const stats = [
  { value: "24k+", label: "Internships tracked", color: "text-blue" },
  { value: "91%", label: "Match accuracy", color: "text-green" },
  { value: "8.4k", label: "Students placed", color: "text-blue" },
];

const features = [
  {
    title: "AI Resume Parsing",
    description:
      "Upload once — we extract skills, experience, and education automatically.",
  },
  {
    title: "Smart Job Matching",
    description:
      "Cosine similarity + skill bonuses rank the best internships for you.",
  },
  {
    title: "Application Tracker",
    description:
      "Kanban board from Saved to Offer. Never lose track of an application.",
  },
];

export default function LandingPage() {
  const router = useRouter();

  const handleParsed = (data: unknown) => {
    const parsed = data as ParsedResume;
    saveParsedResume(parsed);
    router.push("/onboarding");
  };

  return (
    <div className="min-h-screen bg-bg">
      <Navbar />

      <main className="mx-auto max-w-4xl px-6 pt-20 pb-24 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl leading-tight">
          Your{" "}
          <span className="gradient-text">AI career copilot</span>
          <br />
          for landing the perfect internship
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted">
          Upload your resume once. Let CareerPilot analyze your skills, match you
          to the best roles, and guide your growth — every single day.
        </p>

        <div className="mt-12 flex justify-center">
          <ResumeUpload onParsed={handleParsed} />
        </div>

        <div className="mt-16 grid grid-cols-3 gap-8 max-w-lg mx-auto">
          {stats.map((stat) => (
            <div key={stat.label}>
              <p className={`font-mono text-2xl font-medium ${stat.color}`}>
                {stat.value}
              </p>
              <p className="mt-1 text-sm text-muted">{stat.label}</p>
            </div>
          ))}
        </div>
      </main>

      <section className="border-t border-border bg-bg2 py-20">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-center text-2xl font-bold mb-12">
            Everything you need to land your dream role
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {features.map((f) => (
              <div
                key={f.title}
                className="rounded-xl border border-border bg-card p-6"
              >
                <h3 className="font-semibold text-text">{f.title}</h3>
                <p className="mt-2 text-sm text-muted leading-relaxed">
                  {f.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
