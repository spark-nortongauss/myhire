# MyHire – Job Application Tracker

Production-ready **Next.js + Supabase** app to track applications, automate URL imports, and visualize pipeline performance.

## Features
- ✅ Supabase Auth (email/password + magic link)
- ✅ Protected routes with middleware (`/dashboard`, `/jobs`, `/settings`)
- ✅ Dashboard KPIs from `v_user_kpis`
- ✅ Pipeline charts (funnel, weekly applications, top platforms)
- ✅ My Jobs table with filtering/sorting (TanStack Table)
- ✅ Add job manually or import from URL
- ✅ Best-effort URL extraction (`@mozilla/readability` + JSDOM)
- ✅ Optional AI insights from OpenAI (if key provided)
- ✅ Overdue auto-reject after 21 days for `applied` + `no_answer`
- ✅ File uploads (CV + Cover Letter) to Supabase Storage (`job-files` private bucket)
- ✅ Settings page for profile/defaults
- ✅ Tailwind UI + subtle Three.js + GSAP login animation with reduce-motion toggle

---

## 1) Create Supabase project (click-by-click)
1. Go to [supabase.com](https://supabase.com) and click **Start your project**.
2. Click **New project**.
3. Choose your organization.
4. Enter:
   - Project name: `myhire`
   - Database password: choose a strong one and save it safely
   - Region: closest to you
5. Click **Create new project** and wait until setup is complete.

## 2) Database setup
Your SQL schema/views are already prepared according to your note.
If needed, open **Supabase Dashboard → SQL Editor** and run your SQL script there.

Required database objects used by this app:
- `public.job_applications`
- `public.job_events`
- `public.job_imports`
- `public.v_job_applications_enriched`
- `public.v_user_kpis`
- `public.user_profiles` (for Settings)

## 3) Create Storage bucket (private)
1. In Supabase, click **Storage**.
2. Click **Create bucket**.
3. Bucket name: `job-files`
4. Turn **Public bucket** OFF (must be private).
5. Click **Create bucket**.

App file paths:
- CV: `{user_id}/cv/{job_application_id}/{filename}`
- Cover letter: `{user_id}/cover-letter/{job_application_id}/{filename}`

**Storage policy recommendations (Phase 1 hardening):**
- Keep `job-files` bucket private.
- Restrict object paths to `auth.uid()` prefixes (`{user_id}/...`).
- Enforce max file size of 5MB for CV/cover-letter uploads.
- Allow only approved MIME/extensions:
  - CV: PDF (`application/pdf`, `.pdf`)
  - Cover letter: PDF/DOC/DOCX/TXT

## 4) Environment Variables
Set these in `.env.local` for local development and in **Vercel → Project Settings → Environment Variables** for production.

```bash
# Browser + server Supabase config (safe to expose client-side)
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...

# Server-only OpenAI key (NEVER use NEXT_PUBLIC_ prefix)
OPENAI_API_KEY=...

# Server-side rate limiting for /api/import
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...

# Optional server-side key
SUPABASE_SERVICE_ROLE_KEY=...
```

Where to find each value:
1. **Supabase** → Project Settings → API:
   - `NEXT_PUBLIC_SUPABASE_URL` = Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = anon public key
2. **OpenAI** → API Keys:
   - `OPENAI_API_KEY`
3. **Upstash Redis** → Database → REST API:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

## 5) Install and run locally
```bash
npm install
npm run dev
```
Then open `http://localhost:3000`.

## 6) Verify auth and RLS
1. Open `/login`.
2. Sign in with email/password or request magic link.
3. After login, verify you can open `/dashboard`, `/jobs`, `/settings`.
4. Create a job and check it appears only for your account.
5. Confirm RLS policies are enforced with `user_id = auth.uid()`.

## 7) Deploy to Vercel (click-by-click)
1. Push this repo to GitHub.
2. Go to [vercel.com](https://vercel.com) and click **Add New → Project**.
3. Import your GitHub repository.
4. In **Environment Variables**, add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `OPENAI_API_KEY` (server-side only)
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
   - `SUPABASE_SERVICE_ROLE_KEY` (optional)
5. Click **Deploy**.
6. After deploy, open your Vercel URL and test login + jobs flow.

---

## How URL import works
`POST /api/import` with `{ url }`:
1. Inserts `job_imports` row with `status=processing`
2. Downloads the page HTML
3. Extracts readable text using Readability
4. Heuristically infers job title/company/location/salary/work mode/platform
5. Creates `job_applications` row
6. Optionally generates AI insights if `OPENAI_API_KEY` exists
7. Updates `job_imports` as `done` (or `failed` with friendly error)

> Some websites block automated scraping. If import fails, users can still add jobs manually.

## Overdue auto-reject rule
On dashboard/jobs load and via `POST /api/overdue`:
- If status is `applied` or `no_answer`
- and `applied_at` is older than 21 days
- then app updates status to `rejected`

This operation is idempotent and safe to run repeatedly.

## Tech stack
- Next.js App Router + TypeScript
- TailwindCSS
- Supabase (`@supabase/ssr`, `@supabase/supabase-js`)
- TanStack Table
- Recharts
- Three.js + GSAP
- OpenAI SDK (optional)

## Scripts
```bash
npm run dev
npm run build
npm run start
npm run lint
npm run typecheck
```
