# Security Hardening (Phase 1)

This document summarizes the first-phase security controls implemented in this repository.

## 1) Secrets and environment handling
- `OPENAI_API_KEY` is used server-side only.
- Supabase browser keys are read from:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `/login` avoids throwing during prerender when env values are missing by checking env availability before creating the browser client.

## 2) SSRF protections for `POST /api/import`
- URL validation allows only `http`/`https`.
- URLs containing username/password are blocked.
- Private/local/metadata targets are blocked:
  - localhost/loopback
  - link-local
  - RFC1918 ranges
  - metadata endpoint `169.254.169.254`
- DNS resolution validates resolved IP addresses are public.
- Redirect handling is limited to a single redirect and re-validates redirect destinations.
- Fetch protection includes connect/read timeouts and max response size.

## 3) Input validation
- Request payload is validated via Zod:
  - `url` (URL + max 2000 chars)
  - `cvText` (optional, max 30000)
  - `content` (optional, max 30000)
- Invalid payloads return `400`.

## 4) Rate limiting
- Redis-backed limiter via Upstash REST API env vars:
  - `UPSTASH_REDIS_REST_URL`
  - `UPSTASH_REDIS_REST_TOKEN`
- Enforced on `/api/import`:
  - Per user: 10 requests/hour
  - Per IP: 3 requests/minute
- Exceeded limits return `429` with `Retry-After`.

## 5) LLM output treated as untrusted
- AI JSON output is parsed and validated with strict schema:
  - `bullet_insights`: max 5 strings, each max 200 chars
  - `keywords`: max 30 strings, each max 50 chars
  - `risk_flags`: max 20 strings, each max 80 chars
  - `match_score` optional numeric range 0..100
- Numeric score is clamped and stored in `job_applications.match_score`.

## 6) File upload hardening
- Client-side checks enforce file size/type:
  - CV: PDF only, max 5MB
  - Cover letter: PDF/DOC/DOCX/TXT, max 5MB
- Storage best-practice guidance is documented in README.

## 7) Security headers
Global headers are configured in `next.config.mjs`:
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Frame-Options: DENY`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
