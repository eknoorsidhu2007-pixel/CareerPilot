[README-CareerPilot.md](https://github.com/user-attachments/files/31981994/README-CareerPilot.md)
# CareerPilot

![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)
![React](https://img.shields.io/badge/React-18-blue?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-38B2AC?logo=tailwind-css&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%2B%20Auth%20%2B%20RLS-3ECF8E?logo=supabase&logoColor=white)
![Gemini](https://img.shields.io/badge/AI-Gemini%20embeddings%20%2B%20LLM-8E75B2?logo=googlegemini&logoColor=white)
![Jest](https://img.shields.io/badge/Tested%20with-Jest-C21325?logo=jest&logoColor=white)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen)

> **AI co-op & internship matching for university students.**
> Upload a resume → get ranked, explained job matches → apply and level up.

CareerPilot aggregates live co-op and internship listings from four free job
boards, parses an uploaded resume into a structured profile, and ranks every
posting against it using a blend of skill-overlap scoring and sentence-
embedding semantic similarity. Each match comes with a plain-English
explanation of *why* it matched — and the whole experience is wrapped in an
XP / rank / daily-quest system that turns applying into a game.

**No API keys? No database? It still runs.** Every AI and persistence layer
has a deterministic fallback (keyword-only ranking, template explanations,
and an in-browser demo store), so the app is fully functional from a bare
`git clone`.

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [How matching works](#how-matching-works)
- [Gamification](#gamification)
- [Requirements](#requirements)
- [Setup](#setup)
- [Running without Supabase](#running-without-supabase)
- [Testing](#testing)
- [Project structure](#project-structure)
- [Roadmap](#roadmap)
- [Deploy](#deploy)

---

## Features

- **Resume parsing** — upload a PDF (`pdf-parse`) or DOCX (`mammoth`) and get
  a structured profile: skills, experience, education, contact info, links.
- **Ranked job matches** — every posting gets a 0–100 score with matching and
  missing skills surfaced, rendered as a match ring on the dashboard.
- **Plain-English explanations** — an LLM explains the top matches in a sentence
  or two, schema-validated with retry, with a deterministic template fallback
  when no LLM is configured.
- **Semantic matching** — Gemini `text-embedding-004` cosine similarity blended
  50/50 with the keyword score; degrades gracefully to keyword-only ranking if
  the embeddings provider is down.
- **Skill-gap analysis** — the skills most often required by the postings you
  *don't* match, ranked by how many roles each one would unlock.
- **Kanban application tracker** — drag applications through
  saved → applied → OA → interview → offer/rejected (dnd-kit).
- **XP, ranks & daily quests** — applying, saving roles, completing your
  profile, and daily streaks all earn XP toward six rank tiers.

---

## Architecture

```mermaid
flowchart LR
    subgraph Sources["Job boards (free APIs)"]
        R[Remotive]
        RO[RemoteOK]
        M[The Muse]
        A[Arbeitnow]
    end

    subgraph Ingest["Ingestion"]
        SC["lib/scraper.ts<br/>dedupe + normalize"]
    end

    subgraph DB[("Supabase Postgres<br/>+ Auth + RLS")]
    end

    subgraph Profile["Profile"]
        UP[Resume PDF/DOCX]
        RP["lib/resume-parser.ts"]
    end

    subgraph Match["Matching"]
        KW["Keyword scoring<br/>always available"]
        EM["Gemini embeddings<br/>optional"]
        LLM["Gemini LLM explanations<br/>optional"]
    end

    subgraph UI["Dashboard"]
        D[Ranked matches + match ring]
        SG[Skill gaps]
        KB[Kanban board]
        XP[XP / ranks / quests]
    end

    Sources --> SC --> DB
    UP --> RP -->|ParsedResume| Match
    DB -->|jobs| Match
    KW --> Match
    EM -->|cosine similarity| Match
    Match -->|score + matching/missing skills| LLM -->|explanation| UI
    Match --> UI
```

---

## How matching works

1. **Ingest** — `lib/scraper.ts` pulls live listings from four free job
   board APIs: Remotive, RemoteOK, The Muse, and Arbeitnow. Results are
   deduplicated and upserted into Supabase (`app/api/scrape-jobs`).
2. **Parse** — an uploaded resume is turned into structured data — skills,
   experience, education, contact info — by `lib/resume-parser.ts`.
3. **Score** — `lib/matcher.ts` scores every job against the parsed profile:
   - `rankJobsByKeywords` — pure skill-overlap ranking. Synchronous, no
     network calls, always available:
     - skill coverage: `matching / required × 60`
     - `+10` role matches remote preference
     - `+10` role location matches preferred location
     - `+5` title contains "intern", `+4` "co-op", `+3` "junior"
     - `−5` title says "senior" but the profile doesn't
   - `rankJobsForProfile` — the semantic layer. Embeds the candidate's
     skills and every job's title + description (Gemini
     `text-embedding-004`), clamps cosine similarity to [0, 1], scales it to
     a 0–100 contribution, and blends it 50/50 with the keyword score
     (raw cosine similarity on related technical text typically lands around
     0.3–0.8, so it's clamped rather than passed through directly). Falls
     back to pure keyword ranking automatically if `GEMINI_API_KEY` is unset
     or any embedding call fails — a broken embeddings provider degrades
     ranking quality, it never breaks matching outright.
4. **Explain** — `lib/matcher-llm.ts` asks Gemini for a short, schema-
   validated explanation of the top matches (`enrichMatchExplanations`),
   with retry-on-invalid-JSON and a deterministic template fallback
   (`deterministicExplanation`) if the LLM is unavailable or misbehaves.
   The first match acts as a probe — if it falls back, the provider is
   assumed unavailable and the rest keep their deterministic explanations
   rather than each burning their own doomed retry attempts.
5. **Gauge the gap** — `analyzeSkillGaps` surfaces the five skills most
   frequently required across unmatched postings (top skill = high
   priority), so a student knows what to learn next.

---

## Gamification

Every meaningful action awards XP (`types/index.ts` → `XP_EVENTS`):

| Action | XP |
|---|---|
| Apply to a job | 50 |
| Save a job | 10 |
| Complete your profile | 100 |
| Complete daily quests | 100 |
| Mock interview | 60 |
| Streak bonus | 50 |
| Daily login | 5 |

Accumulated XP maps to a six-tier rank track (`RANK_THRESHOLDS`):

| Tier | Title | XP range |
|---|---|---|
| 🥉 Bronze | Aspiring Applicant | 0 – 499 |
| 🥈 Silver | Resume Grinder | 500 – 1,499 |
| 🥇 Gold | Interview Ready | 1,500 – 3,499 |
| 💚 Platinum | Internship Hunter | 3,500 – 6,999 |
| 💎 Diamond | Offer Magnet | 7,000 – 11,999 |
| 🏆 Legend | CareerPilot Elite | 12,000+ |

`lib/gamification.ts` also generates the default daily quest set shown on
the dashboard.

---

## Requirements

| | |
|---|---|
| **Node.js** | 18.17+ (Node 20 LTS recommended) |
| **Gemini API key** | Optional but recommended — https://aistudio.google.com/apikey. Powers semantic matching and match explanations; the app runs without it, just with keyword-only matching and template explanations. |
| **Supabase project** | Optional — https://supabase.com. Without it, the app runs entirely on an in-browser `localStorage` demo store (see [Running without Supabase](#running-without-supabase)). |

---

## Setup

**1. Install dependencies**

```bash
npm install
```

**2. Create your environment file**

```bash
cp .env.example .env.local          # macOS / Linux
Copy-Item .env.example .env.local   # Windows PowerShell
```

| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | no | Supabase → Settings → API → Project URL. Omit to run on the local demo store. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | no | Supabase → Settings → API → `anon` `public` key |
| `SUPABASE_SERVICE_ROLE_KEY` | no | Used server-side only, for job ingestion and match writes. Never expose this to the browser. |
| `GEMINI_API_KEY` | no | Enables semantic matching (`lib/embeddings.ts`) and LLM match explanations (`lib/matcher-llm.ts`). |
| `GEMINI_MODEL` | no | Defaults to `gemini-3.5-flash-lite`. |
| `CRON_SECRET` | no | Shared secret to authorize scheduled calls to `app/api/scrape-jobs`. |

Next.js only reads `.env.local` at startup — restart the dev server after
editing it.

**3. (Optional) Set up the database**

Skip this section entirely to run on the demo store. To persist real data —
user accounts, profiles, scraped jobs, matches, applications, XP — set up
Supabase:

In your Supabase dashboard → SQL Editor → New query, run each migration
below as its own query, in order:

| # | File | What it does |
|---|---|---|
| 1 | `supabase/schema.sql` | Base schema — run this first if starting from an empty project |
| 2 | `supabase/migrations/0001_init.sql` | Core tables: `users`, `profiles`, `jobs`, `matches`, `applications` |
| 3 | `supabase/migrations/0002_rls_policies.sql` | Row-level security — users only read/write their own rows |
| 4 | `supabase/migrations/0003_auth_trigger.sql` | Auto-creates a `users` + `profiles` row on Supabase Auth signup |
| 5 | `supabase/migrations/0004_rename_jobs_url_to_job_url.sql` | Column rename for consistency with the app's types |
| 6 | `supabase/migrations/0005_backfill_existing_auth_users.sql` | Backfills profile rows for any pre-existing auth users |

**4. Run**

```bash
npm run dev
```

Open http://localhost:3000.

---

## Running without Supabase

If `NEXT_PUBLIC_SUPABASE_URL` is unset, every page automatically falls back
to `lib/demo-store.ts` — parsed resumes, profile, jobs, matches, and
applications are all kept in `localStorage` instead of Postgres. This is the
fastest way to try the app or work on matching/UI without provisioning a
database first. The API routes (`app/api/match-jobs`,
`app/api/scrape-jobs`) work the same way regardless — `createSupabaseServer()`
returns `null` when unconfigured, and callers scrape fresh instead of
reading from the DB.

---

## Testing

```bash
npm test            # run once
npm run test:watch  # watch mode
npm run test:coverage
npm run verify      # tests + type-check + lint, in one shot
```

Tests are split into `lib/__tests__/*.node.test.ts` and per-route
`app/api/**/__tests__/*.node.test.ts`, run under Jest's `node` environment
via `jest.config.ts`. `jest.setup.node.ts` deletes `GEMINI_API_KEY` /
`GEMINI_MODEL` from the test process before anything runs — so even a real
key sitting in your `.env.local` can't make `npm run verify` issue live
provider requests. Tests that need to exercise the LLM/embeddings path set
the key explicitly and mock the network call at the module boundary.

---

## Project structure

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
  applications/     kanban board of saved/applied/oa/interview/offer/rejected
  profile/          edit parsed profile and preferences
components/
  ResumeUpload.tsx    resume file dropzone (PDF / DOCX)
  ProfileForm.tsx     edit parsed profile, skills, preferences
  MatchRing.tsx       circular 0-100 match-score visual
  JobCard.tsx         single ranked-match card
  JobMatchModal.tsx   expanded match detail + explanation
  SkillGapPanel.tsx   top missing skills by roles unlocked
  SkillChip.tsx       individual skill badge
  KanbanBoard.tsx     drag-and-drop application pipeline (dnd-kit)
  DailyQuests.tsx     daily quest checklist
  XPBar.tsx           XP progress toward next rank
  DashboardSidebar.tsx / Navbar.tsx
  ui/                 shared button, input primitives
lib/
  scraper.ts        job-board API clients + dedupe/normalize
  resume-parser.ts  PDF/DOCX text extraction + structured parsing
  matcher.ts        keyword ranking + semantic ranking + skill-gap analysis
  embeddings.ts     Gemini text-embedding-004 client, cosine similarity
  matcher-llm.ts    schema-validated LLM match explanations + fallback
  llm.ts            generic Gemini wrapper: retry, timeout, schema validation
  gamification.ts   XP events, rank thresholds, daily quests
  skills.ts         skill taxonomy + text extraction + overlap scoring
  supabase.ts       browser + server Supabase clients
  demo-store.ts     localStorage fallback when Supabase isn't configured
supabase/
  schema.sql        base schema
  migrations/       ordered, idempotent migrations (see Setup above)
```

---

## Roadmap

- Currently tuned for Computer Science students (skill taxonomy, matching
  signals); the data model is intended to extend to other majors — not yet
  built.
- Semantic matching currently embeds job title + description as a whole;
  a follow-up could embed structured resume sections separately for finer-
  grained matching.

---

## Deploy

Deploys cleanly to Vercel. Set the environment variables above in your
Vercel project settings, then schedule ingestion by pointing a cron job (or
[Vercel Cron](https://vercel.com/docs/cron-jobs)) at `/api/scrape-jobs`,
sending your `CRON_SECRET` as a bearer token:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://your-app.vercel.app/api/scrape-jobs
```

Without a scheduled caller, jobs are scraped on demand the first time a
match run needs them, so the app works out of the box even before cron is
configured.
