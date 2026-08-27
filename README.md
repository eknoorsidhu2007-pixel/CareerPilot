CareerPilot
> AI co-op \& internship matching for university students.
> Upload a resume → get ranked, explained job matches → apply and level up.
A Next.js 14 (App Router) + Supabase platform that aggregates live co-op and
internship listings, parses an uploaded resume, and ranks postings against it
using a blend of skill-overlap scoring and sentence-embedding semantic
similarity. Matches come with a plain-English explanation, and the whole
experience is wrapped in a lightweight XP/rank/quest system to keep students
coming back.
Built with Next.js 14, TypeScript, Supabase (Postgres + Auth + RLS), and the
Gemini API (embeddings for matching, LLM for match explanations — both
optional, with deterministic fallbacks when unset).
---
How matching works
Ingest — `lib/scraper.ts` pulls live listings from four free job
board APIs: Remotive, RemoteOK, The Muse, and Arbeitnow. Results are
deduplicated and upserted into Supabase (`app/api/scrape-jobs`).
Parse — an uploaded resume (PDF via `pdf-parse`, or `.docx` via
`mammoth`) is turned into structured data — skills, experience,
education, contact info — by `lib/resume-parser.ts`.
Score — `lib/matcher.ts` scores every job against the parsed profile:
`rankJobsByKeywords` — skill overlap, remote/location preference,
seniority signals. Synchronous, no network calls, always available.
`rankJobsForProfile` — the semantic layer. Embeds the candidate's
skills and every job's title + description (Gemini
`text-embedding-004`), blends cosine similarity 50/50 with the
keyword score. Falls back to pure keyword ranking automatically if
`GEMINI\_API\_KEY` is unset or any embedding call fails — a broken
embeddings provider degrades ranking quality, it never breaks
matching outright.
Explain — `lib/matcher-llm.ts` asks Gemini for a short, schema-
validated explanation of the top matches (`enrichMatchExplanations`),
with retry-on-invalid-JSON and a deterministic template fallback
(`deterministicExplanation`) if the LLM is unavailable or misbehaves.
The first match acts as a probe — if it falls back, the provider is
assumed unavailable and the rest keep their deterministic explanations
rather than each burning their own doomed retry attempts.
Gauge the gap — `analyzeSkillGaps` surfaces the skills most
frequently required across unmatched postings, so a student knows what
to learn next.
---
Requirements
	
Node.js	18.17+ (Node 20 LTS recommended)
Gemini API key	Optional but recommended — https://aistudio.google.com/apikey. Powers semantic matching and match explanations; the app runs without it, just with keyword-only matching and template explanations.
Supabase project	Optional — https://supabase.com. Without it, the app runs entirely on an in-browser `localStorage` demo store (see Running without Supabase).
---
Setup
1. Install dependencies
```bash
npm install
```
2. Create your environment file
```bash
cp .env.example .env.local          # macOS / Linux
Copy-Item .env.example .env.local   # Windows PowerShell
```
Variable	Required	Notes
`NEXT\_PUBLIC\_SUPABASE\_URL`	no	Supabase → Settings → API → Project URL. Omit to run on the local demo store.
`NEXT\_PUBLIC\_SUPABASE\_ANON\_KEY`	no	Supabase → Settings → API → `anon` `public` key
`SUPABASE\_SERVICE\_ROLE\_KEY`	no	Used server-side only, for job ingestion and match writes. Never expose this to the browser.
`GEMINI\_API\_KEY`	no	Enables semantic matching (`lib/embeddings.ts`) and LLM match explanations (`lib/matcher-llm.ts`).
`GEMINI\_MODEL`	no	Defaults to `gemini-3.5-flash-lite`.
`CRON\_SECRET`	no	Shared secret to authorize scheduled calls to `app/api/scrape-jobs`.
Next.js only reads `.env.local` at startup — restart the dev server after
editing it.
3. (Optional) Set up the database
Skip this section entirely to run on the demo store. To persist real data —
user accounts, profiles, scraped jobs, matches, applications, XP — set up
Supabase:
In your Supabase dashboard → SQL Editor → New query, run each
migration below as its own query, in order:
#	File	What it does
1	`supabase/schema.sql`	Base schema — run this first if starting from an empty project
2	`supabase/migrations/0001\_init.sql`	Core tables: `users`, `profiles`, `jobs`, `matches`, `applications`
3	`supabase/migrations/0002\_rls\_policies.sql`	Row-level security — users only read/write their own rows
4	`supabase/migrations/0003\_auth\_trigger.sql`	Auto-creates a `users` + `profiles` row on Supabase Auth signup
5	`supabase/migrations/0004\_rename\_jobs\_url\_to\_job\_url.sql`	Column rename for consistency with the app's types
6	`supabase/migrations/0005\_backfill\_existing\_auth\_users.sql`	Backfills profile rows for any pre-existing auth users
4. Run
```bash
npm run dev
```
Open http://localhost:3000.
---
Running without Supabase
If `NEXT\_PUBLIC\_SUPABASE\_URL` is unset, every page automatically falls back
to `lib/demo-store.ts` — parsed resumes, profile, jobs, matches, and
applications are all kept in `localStorage` instead of Postgres. This is the
fastest way to try the app or work on matching/UI without provisioning a
database first. The API routes (`app/api/match-jobs`,
`app/api/scrape-jobs`) work the same way regardless — `createSupabaseServer()`
returns `null` when unconfigured, and callers scrape fresh instead of
reading from the DB.
---
Testing
```bash
npm test           # run once
npm run test:watch # watch mode
npm run test:coverage
npm run verify      # tests + type-check + lint, in one shot
```
Tests are split into `lib/\_\_tests\_\_/\*.node.test.ts` and per-route
`app/api/\*\*/\_\_tests\_\_/\*.node.test.ts`, run under Jest's `node` environment
via `jest.config.ts`. `jest.setup.node.ts` deletes `GEMINI\_API\_KEY` /
`GEMINI\_MODEL` from the test process before anything runs — so even a real
key sitting in your `.env.local` can't make `npm run verify` issue live
provider requests. Tests that need to exercise the LLM/embeddings path set
the key explicitly and mock the network call at the module boundary.
---
Gamification
Every meaningful action awards XP (`types/index.ts` → `XP\_EVENTS`):
applying to a job, saving a role, completing a profile, logging in daily,
finishing daily quests, a mock interview, or hitting a streak bonus.
Accumulated XP maps to a six-tier rank track, from Bronze — Aspiring
Applicant up to Legend — CareerPilot Elite (`RANK\_THRESHOLDS`).
`lib/gamification.ts` also generates the default daily quest set shown on
the dashboard.
---
Project structure
```
app/
  api/
    scrape-jobs/    ingest listings from Remotive, RemoteOK, The Muse, Arbeitnow
    parse-resume/   PDF/DOCX → structured ParsedResume
    match-jobs/     rank jobs for a profile, blend in semantic + LLM layers
    profile/        read/write the user's profile
    applications/   kanban-style application tracking
    xp/             award XP, recompute rank
  onboarding/       resume upload → parsed profile → first match run
  dashboard/        ranked matches, skill gaps, quests, XP
  applications/     kanban board of applied/interviewing/offer/rejected
  profile/          edit parsed profile and preferences
lib/
  scraper.ts        job-board API clients + dedupe/normalize
  resume-parser.ts  PDF/DOCX text extraction + structured parsing
  matcher.ts         keyword ranking + semantic ranking + skill-gap analysis
  embeddings.ts     Gemini text-embedding-004 client, cosine similarity
  matcher-llm.ts    schema-validated LLM match explanations + fallback
  llm.ts            generic Gemini wrapper: retry, timeout, schema validation
  gamification.ts   XP events, rank thresholds, daily quests
  skills.ts         skill taxonomy + text extraction + overlap scoring
  supabase.ts       browser + server Supabase clients
  demo-store.ts     localStorage fallback when Supabase isn't configured
supabase/
  schema.sql        base schema
  migrations/        ordered, idempotent migrations (see Setup above)
```
---
Roadmap
Currently tuned for Computer Science students (skill taxonomy, matching
signals); the data model is intended to extend to other majors — not yet
built.
Semantic matching currently embeds job title + description as a whole;
a follow-up could embed structured resume sections separately for finer-
grained matching.
---
Deploy
Deploys cleanly to Vercel. Set the environment
variables above in your Vercel project settings, and point a cron job (or
Vercel Cron) at `app/api/scrape-jobs` wi