# CGP LinkedIn AI

LinkedIn DM qualification AI for **CryptoGameplan** (Robin Ritter).
Built by **Airis Solutions** (Felix Schreppel).

## What it does

Runs Robin's LinkedIn outbound + inbound DM conversations end-to-end: identifies fits, opens, qualifies (4-question flow), handles objections, hands off to booking, follows up — all while staying inside Robin's voice and CGP's compliance guardrails.

North star: booked calls on `crypto-gameplan.com/booking`.

## Status

Build started **2026-06-02**. Currently scaffolding integrations — see `docs/architecture/v1-overview.md` for the locked-in architecture and `docs/business/` for ICP, offer, tone, banned phrases, DM flows.

## Stack

- **Language:** TypeScript (strict)
- **Brain:** Claude API — Opus 4.7 for reasoning, Haiku 4.5 for routing
- **DB:** Supabase (Postgres) — AI working memory
- **LinkedIn channel:** Unipile
- **CRM (Robin's view):** GoHighLevel — Supabase syncs one-way → GHL
- **Forms:** Typeform (lead-magnet quiz + application) via webhooks
- **Webhook hub:** n8n
- **Hosting:** Railway / Vercel

## Local setup

```bash
# 1. Install dependencies
npm install

# 2. Copy environment template and fill in real values
cp .env.example .env.local

# 3. Run the local entrypoint (will validate env first)
npm run dev
```

You'll need real values for `ANTHROPIC_API_KEY` and Supabase credentials at minimum. Unipile / GHL / Typeform credentials are required once we wire those services.

## Repo layout

```
src/
  config/        # env loading + validation (zod)
  lib/           # shared clients: claude, supabase, logger
  services/      # business logic (qualification flow, dnc check, etc.)
  handlers/      # webhook + event entrypoints
  prompts/       # versioned Claude system prompts
  types/         # generated db types + shared interfaces
  utils/

supabase/
  migrations/    # versioned SQL migrations

docs/
  architecture/  # v1-overview.md — the locked architecture doc
  business/      # ICP, tone, DM flows, objection handling
  calls/         # Robin sync notes
```

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Run the dev entrypoint with watch reload |
| `npm run typecheck` | Type-check without emitting |
| `npm run lint` | ESLint |
| `npm test` | Vitest |
| `npm run build` | Compile to `dist/` |

## Contact

- Felix Schreppel — info@airissolutions.com
