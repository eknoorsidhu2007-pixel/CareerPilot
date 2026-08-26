import { z } from "zod";

/* -------------------------------------------------------------------------- */
/* Upload constraints                                                          */
/* -------------------------------------------------------------------------- */

export const MAX_RESUME_BYTES = 5 * 1024 * 1024; // 5 MB
export const MIN_EXTRACTED_TEXT_LENGTH = 40;
export const ALLOWED_RESUME_EXTENSIONS = ["pdf", "docx"] as const;

export type ResumeExtension = (typeof ALLOWED_RESUME_EXTENSIONS)[number];

/* -------------------------------------------------------------------------- */
/* Primitives                                                                  */
/* -------------------------------------------------------------------------- */

/** Optional fields in ParsedResume are empty strings, not undefined. */
const optionalEmail = z.union([z.literal(""), z.email()]);
const optionalUrl = z.union([z.literal(""), z.url()]);

/* -------------------------------------------------------------------------- */
/* Resume schemas                                                              */
/* -------------------------------------------------------------------------- */

export const ExperienceItemSchema = z.object({
  title: z.string().min(1, "Experience entries need a title").max(200),
  company: z.string().max(200),
  start_date: z.string().max(60),
  end_date: z.string().max(60),
  description: z.string().max(2000),
  tag: z.string().max(60).optional(),
});

export const EducationItemSchema = z.object({
  school: z.string().min(1, "Education entries need a school").max(200),
  degree: z.string().max(200),
  field: z.string().max(200),
  start_year: z.number().int().min(0).max(2200),
  end_year: z.number().int().min(0).max(2200),
  gpa: z.string().max(10),
  type: z.enum(["degree", "certificate"]).optional(),
});

/**
 * Strict: any key the parser does not know about is a bug, not a passthrough.
 * Mirrors the ParsedResume interface in types/index.ts.
 */
export const ParsedResumeSchema = z.strictObject({
  name: z.string().max(120),
  email: optionalEmail,
  phone: z.string().max(40),
  location: z.string().max(160),
  skills: z.array(z.string().min(1).max(80)).max(30),
  experience: z.array(ExperienceItemSchema).max(6),
  education: z.array(EducationItemSchema).max(5),
  github_url: optionalUrl,
  // LinkedIn is stored here and often arrives without a scheme, so this
  // deliberately is not a URL check.
  portfolio_url: z.string().max(300),
  work_authorization: z.string().max(200),
});

export type ParsedResumeInput = z.infer<typeof ParsedResumeSchema>;

/* -------------------------------------------------------------------------- */
/* Profile schemas (validated before any database write)                       */
/* -------------------------------------------------------------------------- */

export const WorkPreferencesSchema = z.object({
  remote: z.enum(["remote", "hybrid", "onsite", "any"]),
  location: z.string().max(160),
  industries: z.array(z.string().max(80)).max(20),
  salary_min: z.number().int().min(0).max(10_000_000),
  salary_max: z.number().int().min(0).max(10_000_000),
});

export const ProfileUpsertSchema = z.object({
  userId: z.string().min(1, "userId is required").max(200),
  profile: z.object({
    name: z.string().max(120),
    location: z.string().max(160),
    skills: z.array(z.string().min(1).max(80)).max(50),
    github_url: optionalUrl,
    preferences: WorkPreferencesSchema,
  }),
  experiences: z.array(ExperienceItemSchema).max(20).optional().default([]),
  education: z.array(EducationItemSchema).max(20).optional().default([]),
});

export type ProfileUpsertInput = z.infer<typeof ProfileUpsertSchema>;

/* -------------------------------------------------------------------------- */
/* Normalization                                                               */
/* -------------------------------------------------------------------------- */

function cleanString(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

/** parseInt on a failed regex capture yields NaN; the schema rejects NaN. */
function cleanYear(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  const year = Math.trunc(value);
  return year < 0 || year > 2200 ? 0 : year;
}

/**
 * Coerces raw parser output into the shape ParsedResumeSchema expects.
 *
 * This is the normalization half of the pipeline: it repairs what is safely
 * repairable (whitespace, NaN years, duplicate skills, entries missing a
 * title) so that anything still failing validation afterwards is a genuine
 * problem with the document rather than a quirk of the heuristics.
 */
export function normalizeParsedResume(raw: unknown): unknown {
  if (typeof raw !== "object" || raw === null) return raw;
  const input = raw as Record<string, unknown>;

  const skills = Array.isArray(input.skills)
    ? Array.from(
        new Set(
          input.skills
            .map((s) => cleanString(s, 80))
            .filter((s) => s.length > 0)
        )
      ).slice(0, 30)
    : [];

  const experience = Array.isArray(input.experience)
    ? input.experience
        .map((item) => {
          const e = (item ?? {}) as Record<string, unknown>;
          const normalized: Record<string, unknown> = {
            title: cleanString(e.title, 200),
            company: cleanString(e.company, 200),
            start_date: cleanString(e.start_date, 60),
            end_date: cleanString(e.end_date, 60),
            description: cleanString(e.description, 2000),
          };
          const tag = cleanString(e.tag, 60);
          if (tag) normalized.tag = tag;
          return normalized;
        })
        .filter((e) => (e.title as string).length > 0)
        .slice(0, 6)
    : [];

  const education = Array.isArray(input.education)
    ? input.education
        .map((item) => {
          const e = (item ?? {}) as Record<string, unknown>;
          const normalized: Record<string, unknown> = {
            school: cleanString(e.school, 200),
            degree: cleanString(e.degree, 200),
            field: cleanString(e.field, 200),
            start_year: cleanYear(e.start_year),
            end_year: cleanYear(e.end_year),
            gpa: cleanString(e.gpa, 10),
          };
          if (e.type === "degree" || e.type === "certificate") {
            normalized.type = e.type;
          }
          return normalized;
        })
        .filter((e) => (e.school as string).length > 0)
        .slice(0, 5)
    : [];

  return {
    name: cleanString(input.name, 120),
    email: cleanString(input.email, 254).toLowerCase(),
    phone: cleanString(input.phone, 40),
    location: cleanString(input.location, 160),
    skills,
    experience,
    education,
    github_url: cleanString(input.github_url, 300),
    portfolio_url: cleanString(input.portfolio_url, 300),
    work_authorization: cleanString(input.work_authorization, 200),
  };
}

/* -------------------------------------------------------------------------- */
/* Error formatting                                                            */
/* -------------------------------------------------------------------------- */

export interface ValidationIssue {
  path: string;
  message: string;
}

/** Flattens a ZodError into a client-safe list. Never includes input values. */
export function formatIssues(error: z.ZodError): ValidationIssue[] {
  return error.issues.slice(0, 20).map((issue) => ({
    path: issue.path.join(".") || "(root)",
    message: issue.message,
  }));
}
