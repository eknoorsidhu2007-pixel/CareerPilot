"use client";

import { useState } from "react";
import {
  BookOpen,
  GraduationCap,
  Plus,
  Trash2,
} from "lucide-react";
import { SkillChip } from "./SkillChip";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import type {
  EducationItem,
  ExperienceItem,
  ParsedResume,
  WorkPreferences,
} from "@/types";

const SUGGESTED_SKILLS = [
  "Python", "React", "TypeScript", "Node.js", "C++", "DevOps",
  "Docker", "PostgreSQL", "Machine Learning", "Full-Stack Dev",
  "Kubernetes", "AWS", "GraphQL", "Java", "Go",
];

const INDUSTRIES = [
  "Technology", "Finance", "Healthcare", "E-commerce",
  "AI/ML", "Gaming", "Cybersecurity", "EdTech",
];

interface ProfileFormProps {
  initialData?: ParsedResume | null;
  onSubmit: (data: ProfileFormData) => void;
  submitLabel?: string;
  showProgress?: boolean;
  progressStep?: number;
}

export interface ProfileFormData {
  name: string;
  email: string;
  location: string;
  skills: string[];
  experience: ExperienceItem[];
  education: EducationItem[];
  github_url: string;
  preferences: WorkPreferences;
}

export function ProfileForm({
  initialData,
  onSubmit,
  submitLabel = "Find my matches →",
  showProgress = true,
  progressStep = 2,
}: ProfileFormProps) {
  const [skills, setSkills] = useState<string[]>(
    initialData?.skills || ["Python", "React", "Machine Learning", "TypeScript", "Node.js"]
  );
  const [experience, setExperience] = useState<ExperienceItem[]>(
    initialData?.experience || []
  );
  const [education, setEducation] = useState<EducationItem[]>(
    initialData?.education || []
  );
  const [name, setName] = useState(initialData?.name || "");
  const [email, setEmail] = useState(initialData?.email || "");
  const [location, setLocation] = useState(initialData?.location || "");
  const [githubUrl, setGithubUrl] = useState(initialData?.github_url || "");
  const [preferences, setPreferences] = useState<WorkPreferences>({
    remote: "hybrid",
    location: initialData?.location || "",
    industries: ["Technology", "AI/ML"],
    salary_min: 50000,
    salary_max: 120000,
  });
  const [newSkill, setNewSkill] = useState("");

  const toggleSkill = (skill: string) => {
    setSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  };

  const progressPercent = (progressStep / 3) * 100;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name,
      email,
      location,
      skills,
      experience,
      education,
      github_url: githubUrl,
      preferences,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {showProgress && (
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Build your career profile
          </h1>
          <p className="mt-1 text-muted">
            Step {progressStep} of 3 — Skills & Experience
          </p>
          <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-bg3">
            <div
              className="h-full progress-gradient transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Skills */}
      <section>
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted mb-3">
          Skills
        </p>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex flex-wrap gap-2">
            {skills.map((skill) => (
              <SkillChip
                key={skill}
                skill={skill}
                selected
                onRemove={() => toggleSkill(skill)}
              />
            ))}
            {SUGGESTED_SKILLS.filter((s) => !skills.includes(s)).map((skill) => (
              <SkillChip
                key={skill}
                skill={skill}
                suggest
                onToggle={() => toggleSkill(skill)}
              />
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <Input
              placeholder="Add skill..."
              value={newSkill}
              onChange={(e) => setNewSkill(e.target.value)}
              className="max-w-xs"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                if (newSkill && !skills.includes(newSkill)) {
                  setSkills([...skills, newSkill]);
                  setNewSkill("");
                }
              }}
            >
              <Plus className="h-4 w-4" />
              Add skill
            </Button>
          </div>
        </div>
      </section>

      {/* Experience */}
      <section>
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted mb-3">
          Experience
        </p>
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          {experience.map((exp, i) => (
            <div
              key={i}
              className="rounded-lg border border-border bg-bg2 p-4 relative"
            >
              <button
                type="button"
                onClick={() => setExperience(experience.filter((_, j) => j !== i))}
                className="absolute right-3 top-3 text-muted hover:text-red"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <div className="flex items-start justify-between gap-4 pr-8">
                <div className="flex-1 space-y-2">
                  <Input
                    value={exp.title}
                    onChange={(e) => {
                      const updated = [...experience];
                      updated[i] = { ...exp, title: e.target.value };
                      setExperience(updated);
                    }}
                    placeholder="Job title"
                    className="font-semibold"
                  />
                  <Input
                    value={exp.company}
                    onChange={(e) => {
                      const updated = [...experience];
                      updated[i] = { ...exp, company: e.target.value };
                      setExperience(updated);
                    }}
                    placeholder="Company"
                  />
                  <div className="flex gap-2">
                    <Input
                      value={exp.start_date}
                      onChange={(e) => {
                        const updated = [...experience];
                        updated[i] = { ...exp, start_date: e.target.value };
                        setExperience(updated);
                      }}
                      placeholder="Start date"
                      className="text-sm"
                    />
                    <Input
                      value={exp.end_date}
                      onChange={(e) => {
                        const updated = [...experience];
                        updated[i] = { ...exp, end_date: e.target.value };
                        setExperience(updated);
                      }}
                      placeholder="End date"
                      className="text-sm"
                    />
                  </div>
                  <textarea
                    value={exp.description}
                    onChange={(e) => {
                      const updated = [...experience];
                      updated[i] = { ...exp, description: e.target.value };
                      setExperience(updated);
                    }}
                    placeholder="Description"
                    rows={2}
                    className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-muted resize-none focus:outline-none focus:ring-1 focus:ring-blue"
                  />
                </div>
                {exp.tag && (
                  <span className="font-mono text-[10px] text-blue border border-blue/30 rounded px-1.5 py-0.5">
                    {exp.tag}
                  </span>
                )}
              </div>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() =>
              setExperience([
                ...experience,
                {
                  title: "",
                  company: "",
                  start_date: "",
                  end_date: "",
                  description: "",
                },
              ])
            }
          >
            <Plus className="h-4 w-4" />
            Add experience
          </Button>
        </div>
      </section>

      {/* Education */}
      <section>
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted mb-3">
          Education
        </p>
        <div className="rounded-xl border border-border bg-card divide-y divide-border">
          {education.map((edu, i) => (
            <div key={i} className="flex items-start gap-4 p-4">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-bg3">
                {edu.type === "certificate" ? (
                  <BookOpen className="h-5 w-5 text-blue" />
                ) : (
                  <GraduationCap className="h-5 w-5 text-blue" />
                )}
              </div>
              <div className="flex-1 space-y-2">
                <Input
                  value={edu.school}
                  onChange={(e) => {
                    const updated = [...education];
                    updated[i] = { ...edu, school: e.target.value };
                    setEducation(updated);
                  }}
                  placeholder="School / Certificate"
                />
                <Input
                  value={`${edu.degree} ${edu.field}`}
                  onChange={(e) => {
                    const updated = [...education];
                    updated[i] = { ...edu, degree: e.target.value };
                    setEducation(updated);
                  }}
                  placeholder="Degree · Field · Years"
                  className="text-sm text-muted"
                />
              </div>
              {edu.gpa && (
                <span className="font-mono text-xs text-green border border-green/30 rounded px-2 py-0.5">
                  GPA {edu.gpa}
                </span>
              )}
              <button
                type="button"
                onClick={() => setEducation(education.filter((_, j) => j !== i))}
                className="text-muted hover:text-red"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <div className="p-4">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() =>
                setEducation([
                  ...education,
                  {
                    school: "",
                    degree: "",
                    field: "",
                    start_year: 2020,
                    end_year: 2024,
                    gpa: "",
                  },
                ])
              }
            >
              <Plus className="h-4 w-4" />
              Add education
            </Button>
          </div>
        </div>
      </section>

      {/* Work preferences */}
      <section>
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted mb-3">
          Work Preferences
        </p>
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex gap-2 flex-wrap">
            {(["remote", "hybrid", "onsite", "any"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() =>
                  setPreferences({ ...preferences, remote: mode })
                }
                className={`rounded-lg px-4 py-2 text-sm capitalize transition-colors ${
                  preferences.remote === mode
                    ? "bg-blue/10 border border-blue/40 text-text"
                    : "bg-bg2 text-muted border border-border"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
          <Input
            placeholder="Preferred location (e.g. San Francisco, CA)"
            value={preferences.location}
            onChange={(e) =>
              setPreferences({ ...preferences, location: e.target.value })
            }
          />
          <div>
            <p className="text-sm text-muted mb-2">Preferred industries</p>
            <div className="flex flex-wrap gap-2">
              {INDUSTRIES.map((ind) => (
                <button
                  key={ind}
                  type="button"
                  onClick={() => {
                    const industries = preferences.industries.includes(ind)
                      ? preferences.industries.filter((i) => i !== ind)
                      : [...preferences.industries, ind];
                    setPreferences({ ...preferences, industries });
                  }}
                  className={`rounded-lg px-3 py-1.5 text-sm ${
                    preferences.industries.includes(ind)
                      ? "bg-blue/10 border border-blue/40 text-text"
                      : "bg-bg2 text-muted border border-border"
                  }`}
                >
                  {ind}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm text-muted mb-2">
              Salary range: ${preferences.salary_min.toLocaleString()} – $
              {preferences.salary_max.toLocaleString()}
            </p>
            <input
              type="range"
              min={30000}
              max={200000}
              step={5000}
              value={preferences.salary_max}
              onChange={(e) =>
                setPreferences({
                  ...preferences,
                  salary_max: Number(e.target.value),
                })
              }
              className="w-full accent-blue"
            />
          </div>
          <Input
            placeholder="GitHub URL (optional)"
            value={githubUrl}
            onChange={(e) => setGithubUrl(e.target.value)}
          />
        </div>
      </section>

      {/* Basic info */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Input
          placeholder="Full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <Input
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          placeholder="Location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
      </section>

      <div className="flex justify-end gap-3 pb-12">
        <Button type="button" variant="outline">
          ← Back
        </Button>
        <Button type="submit" variant="primary" size="lg">
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
