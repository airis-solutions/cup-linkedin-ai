# Funnel Stages

End-to-end path a lead takes from first contact to closed client. Where LinkedIn sits, what happens at each stage, and what "qualified" means.

Single-call close model. Robin solo, assessment-style.

---

## The full funnel

```
Upstream: AI cold DM  ┐
                      ├──> LinkedIn DM qualification (the AI)
Upstream: lead magnet ┘           │
                                  │  [qualified]
                                  ▼
                         Strategy call (Robin solo, assessment-style)
                                  │
                                  │  [fit confirmed + price accepted on call]
                                  ▼
                               Closed client → onboarding
```

Single-call close. No proposal stage, no second call, no drawn-out sequence. Either the call closes or the lead goes back into parked.

---

## Stage 1 — Upstream (before the AI)

Two sources feed the LinkedIn DM stage:

### Source A: AI outbound cold DM
The agency's AI identifies ICP matches on LinkedIn (see `../general-info/icp.md`) and sends cold openers. Warm responses flow into the qualification flow (see `../dm-flows/qualification-flow.md`).

### Source B: Lead magnet / quiz / ebook
Prospects take the gameplan quiz or download the ebook (URLs in `../links.md`). Those who engage further reach Robin via LinkedIn DM, at which point they enter the qualification flow too.

Both paths converge at the same point: an inbound or warmed DM, ready for qualification.

## Stage 2 — LinkedIn DM qualification (the AI)

Full script and logic in `../dm-flows/qualification-flow.md`. Summary:

- AI asks permission to run a four-question screen
- Q1: how long in crypto
- Q2: what they're trying to improve
- Q3: why that specifically
- Q4: capital deployed or planned
- READ BACK between questions
- Pitch the call with assumed close
- Send booking link

**What "qualified" means at this stage:** meets the ICP criteria (see `../general-info/icp.md`). The AI classifies as Strong fit / Borderline / Weak fit / Disqualified at the end of Q4.

- Strong + Borderline → pitch call, send booking link
- Weak → route to lead magnet, close conversation
- Disqualified → polite close, conversation ends

## Stage 3 — Strategy call (Robin solo, assessment-style)

The call is the close point. Robin runs it alone.

**Format:** Assessment-style, not demo. Not walkthrough.

**Call structure:**
1. Open with the prospect's current situation, pulled from the four qualification answers
2. Diagnose where their current approach is failing (gap analysis)
3. Prescribe CGP if the gap maps to what the program actually solves
4. Present the program structure
5. Present the price
6. Handle any live objections
7. Close on the call

**What the call is NOT:**
- Not a demo of the system mechanics
- Not a "learn about CGP" call
- Not a two-call sequence where the real pitch happens later
- Not a pressure close

**What "qualified at the call" means:** the prospect leaves with either a signed agreement or a clear read that CGP isn't the right fit (in which case Robin closes gracefully and they go into parked).

## Stage 4 — Closed → onboarding

Once signed, the prospect enters CGP onboarding. Out of scope for the AI. The AI's job ended at the booking link.

---

## Where each file in this folder fits

- **`funnel-stages.md`** (this file) — the overall journey.
- **`objection-bank.md`** — how the AI handles the common objections that show up in DMs before the call.
- **`handoff-protocol.md`** — the operational rules for what happens when the AI successfully qualifies a lead and passes to Robin.

For the DM-stage logic itself, see `../dm-flows/qualification-flow.md`. For deeper psychology on why prospects object (useful for Robin's call prep, not the AI's DM handling), see `objections/CGP Core Objections and Psychology.md`.

---

## What the AI is and isn't responsible for

The AI owns the DM stage end-to-end:
- Opener
- Qualification
- Handling DM-stage objections
- Booking-link handoff
- 24h value_touch re-engage
- 72h booking reminder
- Parking leads who don't convert

The AI does NOT:
- Take the strategy call
- Discuss pricing
- Diagnose the prospect's portfolio in detail
- Handle call-stage objections (spouse, liquidity, timing) — those are Robin's on the call
- Chase after two value_touches
- Contact disqualified leads after the polite close

If any lead escalates outside the AI's scope (see `../personal-voice/compliance-guardrails.md` escalation triggers), the AI pauses and flags to Robin.
