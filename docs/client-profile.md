# Client Profile — CryptoGameplan (CGP)

Single-source overview of the client. Detailed source-of-truth lives in [`business/`](business/) (the handoff pack from Robin). This file is the high-level brief; when in doubt, read the original docs.

---

## Identity

- **Brand:** CryptoGameplan (CGP) — `crypto-gameplan.com`
- **Founder:** Robin Ritter (this is the LinkedIn account the AI acts from)
- **Co-Founder:** Jacques Habasch (system / quant side)
- **Robin's background:** 8+ years in crypto, four cycles, business informatics (programming + finance), shifted from discretionary to systematic post-2022 after a major loss. Not a licensed financial advisor.
- **Public CTA Robin uses:** *"DM me 'system' and I'll send the free walkthrough of how the system actually works."*

## What CGP actually is

A **systematic crypto portfolio program** for experienced investors. Replaces personal thesis / opinion with a rules-based daily process that follows where capital is flowing instead of predicting where it will flow.

**The core mechanism — daily 5-question cascade:**
1. Is global liquidity expanding?
2. Is the total crypto market trending up?
3. Which major is leading right now (BTC, ETH, SOL)?
4. Are altcoins showing strength?
5. Which specific alts are leading?

Each layer must answer yes before the next is asked. Risk is wired into every layer, not bolted on at the end.

**CGP is NOT:** a signals service, a course, a copy-trading group, a personality brand.

## Deliverables (clients get)

| Layer | What |
|---|---|
| Execution | Daily Platinum update (video ~20min + text summary, morning drop) |
| Community | Tiered Telegram rooms (tier = course progress, not paid upgrade) |
| Live | 2× per week live calls (Robin + Jacques alternating, deep-dive or workshop) |
| Learning | Academy / structured courses |
| Tooling | Proprietary TradingView indicators + dashboards |
| Allocation | Portfolio templates mapped to risk classes |
| 1:1 | Private channel access for context-specific portfolio questions |

**Structure:** multi-month onboarding → annual cycle. **Pricing:** premium tier (~$10k range per the call-stage objection bank). **Never quoted in DMs** — call only.

## Ideal Customer Profile (ICP)

| Signal | Target |
|---|---|
| Age | 30–55 |
| Capital deployed in crypto | $100k–$300k+ |
| Crypto experience | At least one full cycle, ideally a real drawdown |
| Career | Mid-to-senior, **non-finance** (tech, consulting, ops, hospitality mgmt, founders) |
| Geography | Primarily English-speaking, no hard restriction |
| Mindset | Burned at least once (FTX, leverage), tired of hype, asking for "a system" |

**Reference clients:** David (CH, hospitality, FTX-burned), Rodrigo (35, data engineer, frustrated by social-FOMO).

**Hard disqualifiers (do NOT target):** finance professionals, day traders / scalpers, heavy-leverage maxis, <$50k deployed, 25+ coin "gem hunters", signal/copy-trading seekers.

## Sales funnel (single-call close)

```
LinkedIn cold DM (AI) ─┐
                       ├─► AI DM qualification (4 questions) ─► Strategy call (Robin solo, assessment) ─► Close
Lead magnet / quiz   ──┘
```

**The AI's qualification flow:** welcome → Q1 experience → Q2 what to improve → Q3 why that → Q4 capital → pitch_call → send_link.
**Booking link is the north star** (the only conversion goal). Source-attribution via UTM parameter on the LinkedIn-specific booking link.

**Fit tags after Q4:**
- **Strong** (2+ yrs, process-oriented, $100k+) → pitch call
- **Borderline** ($50–100k or vague) → pitch call + flag for human pre-call review
- **Weak** (<2 of the strong criteria but >$50k) → route to lead magnet, no call
- **Disqualified** → polite close

## Voice & compliance — the non-negotiables

**Voice register:** professional specialist, NOT salesperson. Prestige (calm expertise) NOT dominance (urgency, pressure). Cold-end of professional-polite with surgical warm edges. Never eager.

**Signature moves:**
- READ BACK the prospect's previous answer before the next question
- Assumed close ("Should we book that call?" — never "would you be open to")
- Register mixing inside one message (formal claim + casual line)
- One question per message
- Value-touch re-engage framed as *something I did* — never "just following up"

**Hard bans (zero tolerance):**
- Em dashes (`—`) — single biggest AI tell, search & destroy before sending
- Evaluation words ("Great!", "Awesome!", "Perfect!")
- "I'd love to…", "Just following up", "Just checking in"
- Permission language ("if you want", "would you be willing")
- Any specific performance %, return guarantee, price prediction, retention/member-count number
- Naming competitors
- Crypto-bro slang (HODL, ape, diamond hands, to the moon)
- Emoji on LinkedIn

Full reference: [`business/personal-voice/banned-phrases.md`](business/personal-voice/banned-phrases.md) (3 layers: AI tells, sales-speak, CGP-specific).

**Compliance escalation triggers** (AI stops, hands to Robin): financial/legal/tax advice request, divorce/inheritance/job-loss mentions, regulatory questions, under-18, journalist/regulator/compliance officer claims.

## URLs the AI uses

| Purpose | URL |
|---|---|
| Booking (north star) | https://www.crypto-gameplan.com/booking |
| Website | https://www.crypto-gameplan.com |
| Quiz (soft CTA) | https://www.crypto-gameplan.com/gameplan |
| Portfolio review form | https://www.crypto-gameplan.com/portfolio-review |
| Robin LinkedIn | https://www.linkedin.com/in/robinrittercryptogameplan/ |
| Instagram | https://www.instagram.com/therobinritter/ |
| YouTube | https://www.youtube.com/@cryptogameplan |
| Telegram (community) | https://t.me/cryptogameplan |

## AI scope (what we're building)

**The AI owns end-to-end:** opener → qualification → DM-objection handling → booking handoff → 24h value-touch → 72h booking reminder → parking.

**The AI does NOT:** take the call, discuss price, diagnose portfolios, handle call-stage objections (spouse, liquidity, timing), chase past two value-touches, contact disqualified leads.

**Handoff record (per qualified lead):** identity (LinkedIn URL, name, profile data) + Q1–Q4 answers + soft signals (deployed/invested swap, price-skip attempts, polite-exit patterns, skepticism level) + fit tag + full transcript + source attribution. v1: single log file or DB. No CRM sync, no Slack push, no real-time notifications.

## Source map

| Topic | File |
|---|---|
| What CGP does (plain) | [`business/general-info/what-we-do.md`](business/general-info/what-we-do.md) |
| ICP (full) | [`business/general-info/icp.md`](business/general-info/icp.md) |
| Robin bio (fact sheet) | [`business/general-info/founder-bio.md`](business/general-info/founder-bio.md) |
| The 5-question system | [`business/offer/how-it-works.md`](business/offer/how-it-works.md) |
| Deliverables feature-by-feature | [`business/offer/what-clients-get.md`](business/offer/what-clients-get.md) |
| Funnel end-to-end | [`business/sales/funnel-stages.md`](business/sales/funnel-stages.md) |
| DM qualification script (canonical, do not rewrite) | [`business/dm-flows/qualification-flow.md`](business/dm-flows/qualification-flow.md) |
| DM-stage objections | [`business/sales/objection-bank.md`](business/sales/objection-bank.md) |
| Call-stage objections (Robin's prep, not the AI) | [`business/sales/objections/CGP Core Objections and Psychology.md`](business/sales/objections/CGP%20Core%20Objections%20and%20Psychology.md) |
| Tone | [`business/personal-voice/tone.md`](business/personal-voice/tone.md) |
| Banned phrases (full) | [`business/personal-voice/banned-phrases.md`](business/personal-voice/banned-phrases.md) |
| Compliance | [`business/personal-voice/compliance-guardrails.md`](business/personal-voice/compliance-guardrails.md) |
| Handoff protocol | [`business/sales/handoff-protocol.md`](business/sales/handoff-protocol.md) |
| All URLs | [`business/links.md`](business/links.md) |

## Open questions (for the kickoff with Robin)

1. **Outbound vs warm-only:** Does the AI also do cold outbound prospecting on LinkedIn (ICP-matched, opener-driven), or only handle inbound replies + lead-magnet warmups? `funnel-stages.md` describes both — confirm scope.
2. **Opener patterns file is referenced but missing** in the pack (`business/dm-flows/opener-patterns.md`). Same for `follow-up-patterns.md`. Either Robin still has to write them, or they were left out — clarify before we build.
3. **Volume targets:** how many qualified booked calls/week is the goal? Drives outbound throughput sizing.
4. **Storage / handoff log format:** "agency's choice" — propose a stack (e.g. Supabase + a thin admin view, or a Notion DB Robin can read).
5. **LinkedIn account safety:** Robin's personal account is the asset. Need explicit alignment on action limits per day, randomization, and human-in-the-loop checkpoints to avoid restrictions.
6. **Pricing for our engagement:** Airis ↔ CGP commercials — separate convo.
