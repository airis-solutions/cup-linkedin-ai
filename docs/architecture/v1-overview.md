# Architecture — v1

**Status:** Locked for build start (most decisions made, a few open items below).
**Author:** Airis Solutions (Felix).
**Date:** 2026-06-02 (originally drafted 2026-05-11, updated with Robin's async answers from 2026-05-18).

A high-level view of how the LinkedIn AI for CGP fits together, where GoHighLevel plugs in, and what's confirmed vs. still open before/during build.

---

## Robin's confirmed decisions (2026-05-18 async reply)

| Item | Decision |
|---|---|
| Walkthrough-Asset (`{walkthrough_link}`) | `https://crypto-gameplan.com` — the VSL on the landing page explains "the System" |
| Lead-magnet quiz (`/gameplan`) | External Typeform, Robin has admin/dev access → webhook for completer-trigger |
| Application form (`/questionnaire`) | External Typeform (not GHL!), Robin has admin/dev access → webhook for application-completer signal |
| Do-Not-Contact (existing customers) | Robin has a GHL Smart-List with all existing customers — AI queries it before every cold-outbound send |
| Do-Not-Contact (manual) | None — no extra list of ex-clients / competitors needed |
| Unipile + Sales Navigator monthly cost | Confirmed acceptable by Robin |

**Still open (need before/during build):**
- GHL Private Integration Token + Location ID + Smart-List ID for existing customers
- Typeform Personal Access Token + two Form IDs
- Volume target (bookings/week) → sizes Unipile plan + LinkedIn limits
- Application timing: does `/questionnaire` run *before* or *after* the call-booking?
- LinkedIn action-limit aggressiveness (conservative ~30/day vs. aggressive ~80/day)
- Final-slot picks in `opener-patterns.md` + `follow-up-patterns.md`
- Airis ↔ CGP commercials

---

## Top-level picture

```
                          ┌─────────────────────────────┐
                          │      LinkedIn (Robin's      │
                          │     personal account)       │
                          └──────────────┬──────────────┘
                                         │
                                         │  DMs in/out
                                         ▼
   ┌─────────────────────────────────────────────────────────────┐
   │                        LinkedIn Adapter                     │
   │           (sends/receives DMs, profile lookups,             │
   │             rate-limits, randomization, safety)             │
   └─────────────────────────────────────┬───────────────────────┘
                                         │
                                         ▼
   ┌─────────────────────────────────────────────────────────────┐
   │                          AI Brain                           │
   │                                                             │
   │   ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐   │
   │   │ State Machine│  │ LLM (Claude) │  │ Voice/Compliance│   │
   │   │ (welcome →   │→ │  generates   │→ │   Guard Layer   │   │
   │   │  Q1 → Q2 →…) │  │   message    │  │  (banned-phrase │   │
   │   └──────────────┘  └──────────────┘  │  scan, em-dash, │   │
   │                                       │  compliance)    │   │
   │                                       └─────────────────┘   │
   └─────────────────────────────────────┬───────────────────────┘
                                         │
                                         │  read/write
                                         ▼
   ┌─────────────────────────────────────────────────────────────┐
   │                  Operational DB (Supabase)                  │
   │                                                             │
   │   • conversation state (which node am I on?)                │
   │   • full DM transcripts                                     │
   │   • soft signals as they accumulate                         │
   │   • lead profile snapshot                                   │
   │   • source attribution                                      │
   └─────────────────────────────────────┬───────────────────────┘
                                         │
                                         │  sync (one-way push)
                                         ▼
   ┌─────────────────────────────────────────────────────────────┐
   │                    GoHighLevel (Robin's CRM)                │
   │                                                             │
   │   • Contact created/updated                                 │
   │   • Q1–Q4 in Custom Fields                                  │
   │   • Fit-Tag in Custom Field                                 │
   │   • Pipeline stage: Qualifying → Qualified → Call Booked    │
   │   • Booking already lives here (existing CGP setup)         │
   │   • Robin reads everything here, daily tool                 │
   └─────────────────────────────────────────────────────────────┘
                                         ▲
                                         │
   ┌─────────────────────────────────────┴───────────────────────┐
   │              Robin (HITL + call prep + take-over)           │
   │                                                             │
   │   • Sees every qualified lead in GHL before the call        │
   │   • Can take over any DM thread manually at any time        │
   │   • Gets pinged when AI hits a compliance escalation        │
   └─────────────────────────────────────────────────────────────┘
```

The key idea: GHL is Robin's daily tool and the source-of-truth for leads. Supabase is the AI's working memory. One-way sync from Supabase to GHL keeps Robin's view clean without slowing the AI down.

---

## Component-by-component

### 1. LinkedIn Adapter

The piece that actually talks to LinkedIn. There's no official LinkedIn API for DMs, so this layer is the highest-risk piece.

**What it does:**
- Sends and receives DMs from Robin's personal account
- Reads profile data (name, title, company) for ICP scoring
- Enforces per-day action limits and randomization (so the account doesn't get flagged)
- Routes incoming DMs to the AI Brain
- Routes outgoing AI responses back to LinkedIn

**Build options:**
- **Unipile API** (commercial, paid). Official-ish unofficial gateway, used in production by other LinkedIn bots. Cleanest path, ~$50–$200/month depending on volume.
- **Custom browser automation** (Playwright/Puppeteer running on a server). Cheapest, highest control, highest maintenance. Breaks every time LinkedIn changes their UI.
- **Phantombuster / Expandi / similar** (commercial SaaS). Quick to set up, brittle and opinionated, less control over conversation logic.

**Decision:** Unipile, confirmed 2026-05-18 (Robin accepts monthly cost). Production-grade, predictable cost, doesn't lock us into a vendor's conversation logic.

**Open question for Robin:** is his LinkedIn account in any current automation tool? If yes, we may need to migrate or coexist.

### 2. AI Brain

The conversation engine. Three sub-pieces.

**State Machine:**
- Tracks where each lead is in the qualification flow (welcome → Q1 → Q2 → Q3 → Q4 → pitch_call → send_link → booked/parked)
- Knows when to value_touch, when to park, when to escalate
- Implements the trigger taxonomy from `dm-flows/opener-patterns.md` (cold outbound, CTA reply, post engagement, lead-magnet completer)
- Implements the cadence rules from `dm-flows/follow-up-patterns.md`

**LLM (Claude):**
- Generates the actual DM copy at each state-machine node
- Constrained by the canonical copy in `dm-flows/qualification-flow.md` for locked nodes
- Free-form for read-backs, soft signals, and dynamic content (e.g. answering a tangential question before bridging back)

**Voice / Compliance Guard:**
- Pre-send scan: every outgoing message runs through the banned-phrases scanner, em-dash check, compliance check from `personal-voice/banned-phrases.md` and `personal-voice/compliance-guardrails.md`
- If the LLM produces a banned phrase or compliance violation, the guard rewrites or escalates
- Catches the 15 compliance escalation triggers (financial/legal advice, life events, regulators) and pauses the thread

### 3. Operational DB (Supabase)

Where the AI's working memory lives. Not Robin's view, not the source-of-truth for Robin. The AI's brain on disk.

**Why we need this separate from GHL:**
- GHL API is rate-limited (a few hundred requests/minute). At conversation volume, the AI hits limits during normal use.
- GHL custom fields are not built for full DM transcripts (multi-thousand-character text fields with timestamps).
- AI state machine needs sub-second reads/writes. GHL's API roundtrip is too slow.
- Soft signals accumulate over many turns — easier to manage in a structured DB than in CRM custom fields.

**What lives here:**
- Conversation state per lead
- Full DM transcript per lead
- Soft signals (skepticism, price-skip attempts, deployed→invested swap, etc.)
- Source attribution metadata (UTM, opener variant, post that triggered the lead)
- Audit log of every AI decision (which copy variant, which routing, why)

**What doesn't live here:**
- Anything Robin needs to see daily (that's GHL's job)
- Booking data (that's GHL's job)
- Pricing / contract / payment data (that's GHL's job)

### 4. GHL Sync

The bridge between AI memory and Robin's CRM.

**Direction: one-way push, Supabase → GHL.** The AI never reads from GHL; it only writes summary records when a lead crosses a meaningful threshold.

**Sync triggers (when a write to GHL happens):**
- Lead enters qualification (Q1 answered) → create/update Contact in GHL, set pipeline stage to "Qualifying"
- Lead completes qualification (Q4 answered, fit tag assigned) → update Contact, fill Q1–Q4 custom fields, fit-tag field, set stage to "Qualified"
- Lead receives booking link → set stage to "Call Booked Pending"
- Lead actually books → set stage to "Call Booked" (this may already be a native GHL workflow if booking goes through GHL Calendars)
- Lead is parked or disqualified → set stage to "Parked" or "Disqualified"
- Compliance escalation triggered → set urgent flag, ping Robin

**GHL pieces to configure on Robin's side:**
- A Pipeline for LinkedIn-sourced leads with the stages above
- Custom Fields on Contact: `cgp_q1_experience`, `cgp_q2_improve`, `cgp_q3_why`, `cgp_q4_capital`, `cgp_fit_tag`, `cgp_soft_signals`, `cgp_source`, `cgp_transcript_link`
- A Tag for "LinkedIn AI" so Robin can filter
- Webhook from GHL to the AI when a Calendar booking happens (so AI stops messaging)

**What goes into the Transcript field:** a link to the full transcript view in our internal admin (lightweight Supabase-backed page). GHL is not a great place to store thousands of characters of conversation history; better to link out.

### 5. Robin (Human-in-the-loop)

Robin's interactions with the system, all happening in GHL:

- **Pre-call prep:** opens the GHL Contact for the upcoming call, reads Q1–Q4, fit tag, soft signals, clicks transcript link if needed.
- **Take-over:** Robin can send a DM directly from his LinkedIn account at any time. The adapter detects Robin-sent messages and pauses the AI on that thread. Robin can hand back via a GHL note or a Slack message.
- **Escalations:** when AI flags a compliance escalation (life event, regulator question, etc.), Robin gets pinged (Slack DM or GHL notification) and the thread pauses.
- **Manual overrides:** Robin can mark any lead as "do not contact" or "force qualified" from GHL.

### 6. Lead Magnets and Source Attribution

- LinkedIn-specific booking URL uses a UTM parameter (e.g. `?utm_source=linkedin_ai&utm_campaign=cold_outbound`) so GHL auto-attributes the source on booking.
- Quiz (`crypto-gameplan.com/gameplan`), portfolio review form, ebook downloads each carry their own UTM. The AI knows which lead came from which path.
- AI opener variant is recorded in Supabase per lead, so we can measure which opener converts best over time.

---

## Data flow: happy path (cold outbound to booked call)

```
Day 0   AI identifies ICP match on LinkedIn
        ├─ Creates lead in Supabase (status: opener_pending)
        └─ Sends Trigger A opener via LinkedIn Adapter

Day 0   Lead replies positively
        ├─ State machine moves to: welcome
        ├─ Soft signal logged
        └─ AI sends welcome message

Day 0   Lead agrees to questions
        ├─ State machine: Q1
        ├─ AI sends Q1
        └─ Sync to GHL: create Contact, stage "Qualifying"

Day 0   Lead answers Q1 → Q2 → Q3 → Q4
        ├─ Each answer logged in Supabase
        ├─ READ-BACK pattern applied at Q2, Q3, Q4
        └─ Soft signals accumulated

Day 0   Fit tag assigned (Strong)
        ├─ Sync to GHL: fill Q1–Q4 custom fields, set fit tag, stage "Qualified"
        └─ AI sends pitch_call message

Day 0   Lead agrees to call
        ├─ AI sends booking link with UTM
        └─ Sync to GHL: stage "Call Booked Pending"

Day 0   Lead books via GHL Calendar
        ├─ GHL webhook → AI Adapter
        ├─ AI stops messaging this lead
        └─ Sync to GHL: stage "Call Booked"

Day 1   Robin opens GHL, sees the booking
        ├─ Reads Q1–Q4, fit tag, soft signals on the Contact
        ├─ Clicks transcript link for full DM history if needed
        └─ Walks into the call prepared
```

---

## Tech stack proposal

| Layer | Tech | Reason |
|---|---|---|
| LinkedIn Adapter | Unipile API | Production-grade, predictable, doesn't lock us in |
| AI Brain | TypeScript + Claude API | TS strict mode (per Felix's preference), Claude 4.7 for the heaviest reasoning, Haiku for cheap routing decisions |
| Operational DB | Supabase (Postgres) | Free tier covers v1, scales, structured queries free |
| Webhook receiver | TypeScript backend, direct HTTP endpoints (no n8n) | Typeform / GHL / Unipile post directly — one fewer system to host and monitor |
| GHL Sync | TypeScript worker, GHL REST API + webhooks | Direct integration, no third-party glue |
| Admin view (transcript reader) | Small Next.js page, Supabase auth for Robin | Robin clicks from GHL into transcript, ~1 week of build |
| Hosting | Vercel (admin) + Railway/Fly.io (worker + adapter) | Cheap, fast deploys |
| Observability | Logs to Supabase + Sentry for errors | Robin doesn't see this, Airus monitors |

---

## What's NOT in v1

To keep scope tight:

- No realtime Slack notifications (GHL stage changes are enough)
- No multi-language support (English only)
- No A/B testing infrastructure for openers (we run the locked Final from each trigger, period)
- No automated reactivation campaigns for parked leads (they re-enter on their own)
- No payment / contract handling (GHL native if needed)
- No analytics dashboard (Supabase queries are enough for Airus to monitor)

v2 candidates: Slack push, A/B testing, automated reactivation, performance analytics.

---

## Open questions for the Robin sync

Still open (as of 2026-06-02):

| # | Question | Why we need it | Status |
|---|---|---|---|
| 1 | Is `crypto-gameplan.com/booking` running through GHL Calendars today? | Confirms the booking webhook path | Open |
| 2 | Does GHL have an existing Pipeline for Robin's CGP leads, or do we create one fresh for LinkedIn AI? | Affects naming + stages + reporting | Open |
| 3 | What's the volume target? (qualified booked calls per week) | Sizes Unipile plan + LinkedIn action limits | Asked 2026-06-02 in DM |
| 4 | LinkedIn account safety: any current restrictions on Robin's account? Any tools currently automating it? | Avoids account flags + tool conflicts | Open |
| 5 | Is Robin OK with the AI writing Contacts into his existing GHL workspace (with a tag), or does he want a separate sub-account? | Affects GHL setup, billing, isolation | Asked 2026-06-02 in DM |
| 6 | Compliance escalation channel: Slack, SMS, GHL notification, email? Where should Robin get pinged? | Affects HITL implementation | Open |
| 7 | Who owns the Unipile subscription, Airis or CGP? | Affects commercials | Open — covered in commercials call |
| 8 | Robin's existing GHL Custom Fields: anything we should reuse vs. create new? | Avoids duplicating fields | Open |
| 9 | Does `/questionnaire` (Typeform application) run *before* or *after* the call booking? | Determines whether Application-completion is a trigger or a state-sync event | Asked 2026-06-02 in DM |

---

## Decision capture

| Question | Decision | Date |
|---|---|---|
| Storage approach (Supabase + GHL sync) | Supabase = AI working memory, GHL = Robin's source-of-truth, one-way push Supabase → GHL | 2026-05-11 |
| LinkedIn adapter (Unipile) | Confirmed, Robin OK with monthly cost | 2026-05-18 |
| Walkthrough-Asset | `https://crypto-gameplan.com` (landing page VSL) | 2026-05-18 |
| Lead-magnet quiz on Typeform with webhook | Confirmed | 2026-05-18 |
| Application on Typeform with webhook | Confirmed | 2026-05-18 |
| DNC for existing customers | GHL Smart-List query before every cold-outbound | 2026-05-18 |
| n8n in stack? | Dropped — direct webhook endpoints on our TypeScript backend instead (one less hosted system, one less point of failure). n8n can be added later if Robin or Felix want self-service workflows. | 2026-06-02 |
| Project kickoff (build start) | 2026-06-02 | 2026-06-02 |
| GHL workspace (existing vs. new sub-account) | Pending | — |
| Volume target | Pending — asked in DM 2026-06-02 | — |
| Compliance escalation channel | Pending | — |
| Unipile subscription owner | Pending — commercials call | — |

---

## Build phases (rough sizing)

| Phase | Scope | Time |
|---|---|---|
| Phase 0 — GHL setup with Robin | Pipeline, Custom Fields, Calendar webhook | 1 day |
| Phase 1 — Storage + State Machine | Supabase schema, state machine in TS, no LinkedIn yet | 1 week |
| Phase 2 — AI Brain | LLM integration, voice guard, banned-phrase scanner, copy generation per node | 1.5 weeks |
| Phase 3 — LinkedIn Adapter | Unipile integration, action limits, randomization, take-over detection | 1 week |
| Phase 4 — GHL Sync | One-way push, Custom Field mapping, stage transitions, webhook listener | 4 days |
| Phase 5 — Admin transcript view | Small Next.js page, Supabase auth, Robin-readable transcript | 3 days |
| Phase 6 — End-to-end testing with Robin | Live thread tests, voice tuning, compliance scan tuning | 1 week |
| **Total** | | **~6 weeks** |

This assumes one engineer full-time, no major scope changes mid-build, and Robin available for the Phase 0 setup and Phase 6 review.

---

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| LinkedIn account restriction or ban | High | Conservative action limits, randomization, HITL on edge cases, Unipile's compliance posture |
| AI sends a compliance-violating message that Robin doesn't catch | High | Pre-send compliance scanner, escalation triggers, full audit log |
| GHL API rate limits during burst traffic | Medium | Supabase queue between AI and GHL, batched syncs |
| Unipile pricing changes mid-build | Low | Adapter pattern means we can swap providers without rewriting the AI Brain |
| Robin's voice diverges from the locked copy over time | Medium | Quarterly voice-options review, banned-phrase regression tests |
