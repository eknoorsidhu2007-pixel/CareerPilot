-- CareerPilot Supabase Schema
-- Run this in the Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users (extends auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT,
  location TEXT,
  skills TEXT[] DEFAULT '{}',
  github_url TEXT,
  portfolio_url TEXT,
  work_auth TEXT,
  preferences JSONB DEFAULT '{}',
  xp INT DEFAULT 0,
  rank TEXT DEFAULT 'Bronze',
  streak INT DEFAULT 0,
  last_active DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Experiences
CREATE TABLE IF NOT EXISTS public.experiences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  start_date TEXT,
  end_date TEXT,
  description TEXT,
  tag TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Education
CREATE TABLE IF NOT EXISTS public.education (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  school TEXT NOT NULL,
  degree TEXT,
  field TEXT,
  start_year INT,
  end_year INT,
  gpa TEXT,
  type TEXT DEFAULT 'degree',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Jobs (scraped)
CREATE TABLE IF NOT EXISTS public.jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  location TEXT,
  remote TEXT,
  description TEXT,
  skills_required TEXT[] DEFAULT '{}',
  salary_range TEXT,
  url TEXT UNIQUE,
  source TEXT,
  posted_date TIMESTAMPTZ,
  applicant_count INT,
  scraped_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Matches
CREATE TABLE IF NOT EXISTS public.matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  score FLOAT NOT NULL,
  explanation TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, job_id)
);

-- Applications
CREATE TABLE IF NOT EXISTS public.applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'saved',
  notes TEXT,
  deadline DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, job_id)
);

-- XP Events
CREATE TABLE IF NOT EXISTS public.xp_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  xp_gained INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Daily Quests
CREATE TABLE IF NOT EXISTS public.daily_quests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  quests JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Scrape cache metadata
CREATE TABLE IF NOT EXISTS public.scrape_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source TEXT NOT NULL,
  jobs_found INT DEFAULT 0,
  ran_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_jobs_scraped_at ON public.jobs(scraped_at DESC);
CREATE INDEX IF NOT EXISTS idx_matches_user_score ON public.matches(user_id, score DESC);
CREATE INDEX IF NOT EXISTS idx_applications_user_status ON public.applications(user_id, status);
CREATE INDEX IF NOT EXISTS idx_experiences_user ON public.experiences(user_id);
CREATE INDEX IF NOT EXISTS idx_education_user ON public.education(user_id);

-- RLS Policies
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.education ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xp_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_quests ENABLE ROW LEVEL SECURITY;

-- Users: own row only
CREATE POLICY "users_select_own" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users_insert_own" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);

-- Profiles
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- Experiences
CREATE POLICY "experiences_all_own" ON public.experiences FOR ALL USING (auth.uid() = user_id);

-- Education
CREATE POLICY "education_all_own" ON public.education FOR ALL USING (auth.uid() = user_id);

-- Jobs: readable by all authenticated users
CREATE POLICY "jobs_select_authenticated" ON public.jobs FOR SELECT TO authenticated USING (true);

-- Matches
CREATE POLICY "matches_all_own" ON public.matches FOR ALL USING (auth.uid() = user_id);

-- Applications
CREATE POLICY "applications_all_own" ON public.applications FOR ALL USING (auth.uid() = user_id);

-- XP Events
CREATE POLICY "xp_events_all_own" ON public.xp_events FOR ALL USING (auth.uid() = user_id);

-- Daily Quests
CREATE POLICY "daily_quests_all_own" ON public.daily_quests FOR ALL USING (auth.uid() = user_id);

-- Service role bypass for scraping (use service role key in API routes)
-- Jobs insert via service role only in scrape-jobs route

-- Trigger: create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email) VALUES (NEW.id, NEW.email);
  INSERT INTO public.profiles (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
