export interface ParsedResume {
  name: string;
  email: string;
  phone: string;
  location: string;
  skills: string[];
  experience: ExperienceItem[];
  education: EducationItem[];
  github_url: string;
  portfolio_url: string;
  work_authorization: string;
}

export interface ExperienceItem {
  title: string;
  company: string;
  start_date: string;
  end_date: string;
  description: string;
  tag?: string;
}

export interface EducationItem {
  school: string;
  degree: string;
  field: string;
  start_year: number;
  end_year: number;
  gpa: string;
  type?: "degree" | "certificate";
}

export interface WorkPreferences {
  remote: "remote" | "hybrid" | "onsite" | "any";
  location: string;
  industries: string[];
  salary_min: number;
  salary_max: number;
}

export interface UserProfile {
  user_id: string;
  name: string;
  location: string;
  skills: string[];
  github_url: string;
  portfolio_url: string;
  work_auth: string;
  preferences: WorkPreferences;
  xp: number;
  rank: string;
  streak: number;
  last_active: string;
}

export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  remote: string;
  description: string;
  skills_required: string[];
  salary_range: string | null;
  url: string;
  source: string;
  posted_date: string;
  applicant_count?: number;
  scraped_at: string;
}

export interface JobMatch {
  id: string;
  user_id: string;
  job_id: string;
  score: number;
  explanation: string;
  job: Job;
}

export interface Application {
  id: string;
  user_id: string;
  job_id: string;
  status: ApplicationStatus;
  notes: string;
  deadline: string | null;
  job?: Job;
}

export type ApplicationStatus =
  | "saved"
  | "applied"
  | "oa"
  | "interview"
  | "rejected"
  | "offer";

export interface DailyQuest {
  id: string;
  label: string;
  xp: number;
  completed: boolean;
  type: "apply" | "save" | "interview" | "resume";
}

export interface SkillGap {
  skill: string;
  rolesUnlocked: number;
  priority: "high" | "medium" | "low";
}

export type RankTier =
  | "Bronze"
  | "Silver"
  | "Gold"
  | "Platinum"
  | "Diamond"
  | "Legend";

export interface RankInfo {
  tier: RankTier;
  title: string;
  minXp: number;
  maxXp: number;
  color: string;
}

export const RANK_THRESHOLDS: RankInfo[] = [
  { tier: "Bronze", title: "Aspiring Applicant", minXp: 0, maxXp: 499, color: "#CD7F32" },
  { tier: "Silver", title: "Resume Grinder", minXp: 500, maxXp: 1499, color: "#C0C0C0" },
  { tier: "Gold", title: "Interview Ready", minXp: 1500, maxXp: 3499, color: "#F59E0B" },
  { tier: "Platinum", title: "Internship Hunter", minXp: 3500, maxXp: 6999, color: "#10B981" },
  { tier: "Diamond", title: "Offer Magnet", minXp: 7000, maxXp: 11999, color: "#3B82F6" },
  { tier: "Legend", title: "CareerPilot Elite", minXp: 12000, maxXp: Infinity, color: "#F5F5F5" },
];

export const XP_EVENTS = {
  apply_to_job: 50,
  save_job: 10,
  complete_profile: 100,
  daily_login: 5,
  complete_daily_quests: 100,
  mock_interview: 60,
  streak_bonus: 50,
} as const;

export type XpEventType = keyof typeof XP_EVENTS;
