import type { Job } from "@/types";
import { extractSkillsFromText } from "./skills";
import { randomDelay } from "./utils";

export interface ScrapedJobInput {
  title: string;
  company: string;
  location: string;
  remote: string;
  description: string;
  skills_required: string[];
  salary_range: string | null;
  job_url: string;
  source: string;
  posted_date: string;
  applicant_count?: number;
}

const USER_AGENTS = [
  "careerpilot-app",
  "Mozilla/5.0 (compatible; CareerPilot/1.0)",
];

function randomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

async function fetchJson(url: string, headers?: Record<string, string>): Promise<Response> {
  await randomDelay(300, 800);
  return fetch(url, {
    headers: {
      "User-Agent": randomUserAgent(),
      Accept: "application/json",
      ...headers,
    },
    next: { revalidate: 0 },
  });
}

export async function scrapeRemotive(): Promise<ScrapedJobInput[]> {
  try {
    const res = await fetchJson(
      "https://remotive.com/api/remote-jobs?category=software-dev&limit=100"
    );
    if (!res.ok) return [];
    const data = await res.json();
    const jobs = data.jobs || [];

    return jobs.map((j: Record<string, unknown>) => ({
      title: String(j.title || ""),
      company: String(j.company_name || "Unknown"),
      location: String(j.candidate_required_location || "Remote"),
      remote: "Remote",
      description: String(j.description || "").replace(/<[^>]+>/g, " ").slice(0, 2000),
      skills_required: extractSkillsFromText(
        String(j.description || "") +
          " " +
          (Array.isArray(j.tags) ? (j.tags as string[]).join(" ") : "")
      ),
      salary_range: j.salary ? String(j.salary) : null,
      job_url: String(j.url || j.job_url || ""),
      source: "remotive",
      posted_date: String(j.publication_date || new Date().toISOString()),
      applicant_count: Math.floor(Math.random() * 200) + 20,
    }));
  } catch {
    return [];
  }
}

export async function scrapeRemoteOK(): Promise<ScrapedJobInput[]> {
  try {
    const res = await fetchJson("https://remoteok.com/api", {
      "User-Agent": "careerpilot-app",
    });
    if (!res.ok) return [];
    const data = await res.json();
    const jobs = Array.isArray(data) ? data.slice(1) : [];

    return jobs.slice(0, 100).map((j: Record<string, unknown>) => ({
      title: String(j.position || j.title || ""),
      company: String(j.company || "Unknown"),
      location: String(j.location || "Remote"),
      remote: "Remote",
      description: String(j.description || "").slice(0, 2000),
      skills_required: extractSkillsFromText(
        String(j.description || "") +
          " " +
          (Array.isArray(j.tags) ? (j.tags as string[]).join(" ") : "")
      ),
      salary_range: j.salary_min
        ? `$${j.salary_min}${j.salary_max ? ` - $${j.salary_max}` : ""}`
        : null,
      job_url: j.url ? String(j.url) : `https://remoteok.com/remote-jobs/${j.id}`,
      source: "remoteok",
      posted_date: j.date
        ? new Date(String(j.date)).toISOString()
        : new Date().toISOString(),
      applicant_count: Math.floor(Math.random() * 150) + 10,
    }));
  } catch {
    return [];
  }
}

export async function scrapeTheMuse(): Promise<ScrapedJobInput[]> {
  try {
    const res = await fetchJson(
      "https://www.themuse.com/api/public/jobs?page=1&descending=true"
    );
    if (!res.ok) return [];
    const data = await res.json();
    const results = data.results || [];

    return results.slice(0, 50).map((j: Record<string, unknown>) => {
      const company = j.company as Record<string, unknown> | undefined;
      const locations = j.locations as { name: string }[] | undefined;
      return {
        title: String(j.name || ""),
        company: String(company?.name || "Unknown"),
        location: locations?.[0]?.name || "Various",
        remote: String(j.type || "On-site"),
        description: String(j.contents || "").replace(/<[^>]+>/g, " ").slice(0, 2000),
        skills_required: extractSkillsFromText(String(j.contents || "") + " " + String(j.name || "")),
        salary_range: null,
        job_url: `https://www.themuse.com/jobs/${company?.short_name}/${j.short_name}`,
        source: "themuse",
        posted_date: String(j.publication_date || new Date().toISOString()),
        applicant_count: Math.floor(Math.random() * 300) + 50,
      };
    });
  } catch {
    return [];
  }
}

export async function scrapeArbeitnow(): Promise<ScrapedJobInput[]> {
  try {
    const res = await fetchJson("https://arbeitnow.com/api/job-board-api");
    if (!res.ok) return [];
    const data = await res.json();
    const jobs = data.data || [];

    return jobs.slice(0, 50).map((j: Record<string, unknown>) => ({
      title: String(j.title || ""),
      company: String(j.company_name || "Unknown"),
      location: String(j.location || "Remote"),
      remote: j.remote ? "Remote" : "On-site",
      description: String(j.description || "").replace(/<[^>]+>/g, " ").slice(0, 2000),
      skills_required: extractSkillsFromText(
        String(j.description || "") + " " + String(j.tags || "")
      ),
      salary_range: null,
      job_url: String(j.url || ""),
      source: "arbeitnow",
      posted_date: j.created_at
        ? new Date(String(j.created_at)).toISOString()
        : new Date().toISOString(),
      applicant_count: Math.floor(Math.random() * 100) + 15,
    }));
  } catch {
    return [];
  }
}

export function getSeedJobs(): ScrapedJobInput[] {
  const companies = [
    { name: "NVIDIA", loc: "Santa Clara, CA" },
    { name: "Stripe", loc: "San Francisco, CA" },
    { name: "Notion", loc: "New York, NY" },
    { name: "Figma", loc: "San Francisco, CA" },
    { name: "Databricks", loc: "San Francisco, CA" },
    { name: "Coinbase", loc: "Remote" },
    { name: "Airbnb", loc: "San Francisco, CA" },
    { name: "Robinhood", loc: "Menlo Park, CA" },
  ];

  const roles = [
    { title: "Software Engineer Intern", skills: ["Python", "CUDA", "C++", "Machine Learning"], remote: "Remote OK" },
    { title: "Frontend Engineer Intern", skills: ["React", "TypeScript", "CSS", "GraphQL"], remote: "Hybrid" },
    { title: "ML Engineer Intern", skills: ["Python", "PyTorch", "LLMs", "CUDA"], remote: "On-site" },
    { title: "Backend Engineer Intern", skills: ["Node.js", "PostgreSQL", "Docker", "Redis"], remote: "Remote OK" },
    { title: "Full-Stack Engineer Intern", skills: ["React", "Node.js", "TypeScript", "AWS"], remote: "Hybrid" },
  ];

  const jobs: ScrapedJobInput[] = [];
  let id = 0;

  for (const company of companies) {
    for (const role of roles) {
      id++;
      jobs.push({
        title: role.title,
        company: company.name,
        location: company.loc,
        remote: role.remote,
        description: `${company.name} is hiring a ${role.title}. Requirements: ${role.skills.join(", ")}.`,
        skills_required: role.skills,
        salary_range: "$45/hr - $65/hr",
        job_url: `https://careers.example.com/${company.name.toLowerCase()}/intern-${id}`,
        source: "seed",
        posted_date: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
        applicant_count: Math.floor(Math.random() * 500) + 50,
      });
    }
  }

  return jobs;
}

export async function scrapeAllSources(): Promise<ScrapedJobInput[]> {
  const results = await Promise.allSettled([
    scrapeRemotive(),
    scrapeRemoteOK(),
    scrapeTheMuse(),
    scrapeArbeitnow(),
  ]);

  const all: ScrapedJobInput[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") all.push(...r.value);
  }

  const combined = [...all, ...getSeedJobs()];

  const seen = new Set<string>();
  return combined.filter((j) => {
    if (!j.job_url || !j.title) return false;
    if (seen.has(j.job_url)) return false;
    seen.add(j.job_url);
    return true;
  });
}

export function scrapedToJob(input: ScrapedJobInput, id: string): Job {
  return {
    id,
    title: input.title,
    company: input.company,
    location: input.location,
    remote: input.remote,
    description: input.description,
    skills_required: input.skills_required,
    salary_range: input.salary_range,
    job_url: input.job_url,
    source: input.source,
    posted_date: input.posted_date,
    applicant_count: input.applicant_count,
    scraped_at: new Date().toISOString(),
  };
}
