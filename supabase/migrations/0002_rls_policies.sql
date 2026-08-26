-- 0002 row level security policies
-- Idempotent: safe to re-run against an existing database.

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
DROP POLICY IF EXISTS "users_select_own" ON public.users;
CREATE POLICY "users_select_own" ON public.users FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS "users_insert_own" ON public.users;
CREATE POLICY "users_insert_own" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);

-- Profiles
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- Experiences
DROP POLICY IF EXISTS "experiences_all_own" ON public.experiences;
CREATE POLICY "experiences_all_own" ON public.experiences FOR ALL USING (auth.uid() = user_id);

-- Education
DROP POLICY IF EXISTS "education_all_own" ON public.education;
CREATE POLICY "education_all_own" ON public.education FOR ALL USING (auth.uid() = user_id);

-- Jobs: readable by all authenticated users
DROP POLICY IF EXISTS "jobs_select_authenticated" ON public.jobs;
CREATE POLICY "jobs_select_authenticated" ON public.jobs FOR SELECT TO authenticated USING (true);

-- Matches
DROP POLICY IF EXISTS "matches_all_own" ON public.matches;
CREATE POLICY "matches_all_own" ON public.matches FOR ALL USING (auth.uid() = user_id);

-- Applications
DROP POLICY IF EXISTS "applications_all_own" ON public.applications;
CREATE POLICY "applications_all_own" ON public.applications FOR ALL USING (auth.uid() = user_id);

-- XP Events
DROP POLICY IF EXISTS "xp_events_all_own" ON public.xp_events;
CREATE POLICY "xp_events_all_own" ON public.xp_events FOR ALL USING (auth.uid() = user_id);

-- Daily Quests
DROP POLICY IF EXISTS "daily_quests_all_own" ON public.daily_quests;
CREATE POLICY "daily_quests_all_own" ON public.daily_quests FOR ALL USING (auth.uid() = user_id);

-- Service role bypass for scraping (use service role key in API routes)
-- Jobs insert via service role only in scrape-jobs route
