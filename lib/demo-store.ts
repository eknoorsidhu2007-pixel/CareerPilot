import type { Application, Job, JobMatch, ParsedResume, UserProfile } from "@/types";

const KEYS = {
  parsed: "cp_parsed_resume",
  profile: "cp_profile",
  jobs: "cp_jobs",
  matches: "cp_matches",
  applications: "cp_applications",
  userId: "cp_user_id",
};

function getItem<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function setItem<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

export function getDemoUserId(): string {
  let id = getItem<string | null>(KEYS.userId, null);
  if (!id) {
    id = `demo-${crypto.randomUUID()}`;
    setItem(KEYS.userId, id);
  }
  return id;
}

export function saveParsedResume(data: ParsedResume): void {
  setItem(KEYS.parsed, data);
}

export function getParsedResume(): ParsedResume | null {
  return getItem<ParsedResume | null>(KEYS.parsed, null);
}

export function saveDemoProfile(profile: UserProfile): void {
  setItem(KEYS.profile, profile);
}

export function getDemoProfile(): UserProfile | null {
  return getItem<UserProfile | null>(KEYS.profile, null);
}

export function saveDemoJobs(jobs: Job[]): void {
  setItem(KEYS.jobs, jobs);
}

export function getDemoJobs(): Job[] {
  return getItem<Job[]>(KEYS.jobs, []);
}

export function saveDemoMatches(matches: JobMatch[]): void {
  setItem(KEYS.matches, matches);
}

export function getDemoMatches(): JobMatch[] {
  return getItem<JobMatch[]>(KEYS.matches, []);
}

export function saveDemoApplications(apps: Application[]): void {
  setItem(KEYS.applications, apps);
}

export function getDemoApplications(): Application[] {
  return getItem<Application[]>(KEYS.applications, []);
}
