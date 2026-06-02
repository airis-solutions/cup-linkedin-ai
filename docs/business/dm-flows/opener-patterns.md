# Opener Patterns (LinkedIn)

The first message in any AI-run thread. Three versions of every opener, ranked by temperature, mirroring the structure of [qualification-flow-voice-options.md](qualification-flow-voice-options.md):

- **V1 — Warmest** (professional-polite baseline)
- **V2 — +10% colder** (one warmth signal stripped)
- **V3 — +50% colder** (most warmth stripped, purely professional)

Below each, a `**Final:**` slot for Robin to lock in the canonical copy. Once every slot is filled, this becomes the AI's opener library.

The structure, routing, and register rules don't change across versions. Voice rules from [../personal-voice/tone.md](../personal-voice/tone.md) and [../personal-voice/banned-phrases.md](../personal-voice/banned-phrases.md) apply to every version. Compliance from [../personal-voice/compliance-guardrails.md](../personal-voice/compliance-guardrails.md) applies to every version.

Variables:
- `{first_name}` — lead's first name from LinkedIn profile
- `{walkthrough_link}` — Robin's free walkthrough asset (URL to be added to [../links.md](../links.md); currently referenced as `[link]` in qualification-flow Node 3)
- `{quiz_link}` — see [../links.md](../links.md)

---

## Trigger taxonomy

The AI sends an opener under one of four conditions. Each routes to a different opener pattern.

| Trigger | Source | Coldness | Routes to |
|---|---|---|---|
| **A — Cold outbound** | AI identifies an ICP match on LinkedIn (no prior interaction) | Coldest | Trigger A opener → welcome (qualification-flow Node 1) on positive reply |
| **B — CTA reply** | Lead DMs "system" (or near-variant) in response to Robin's public CTA | Warmest | Trigger B opener → walkthrough sent, bridge to Q1 |
| **C — Post engagement** | Lead leaves a substantive comment on a Robin post and the AI follows up in DMs | Warm | Trigger C opener → welcome (qualification-flow Node 1) on positive reply |
| **D — Lead-magnet completer** | Lead completes the quiz or downloads the ebook and surfaces in DMs | Warm | Trigger D opener → bridge directly to Q1 |

If a lead is fully cold (no signal), use Trigger A. If the lead has signaled intent in any way (B, C, D), use the corresponding warmer pattern. Never run Trigger A on someone who already engaged with Robin's content or CTA.

---

## Trigger A — Cold outbound

**When:** ICP match identified (see [../general-info/icp.md](../general-info/icp.md)), no prior interaction with Robin or CGP. The AI is initiating from zero.

**Principle:** Specialist-introduction, not pitch. State who Robin is and what he does, name the ICP, ask for a short conversation. Avoid profile-mining ("I noticed your background in..."), rapport-faking, flattery, and performance hooks. Compliance: zero performance, pricing, or prediction in the opener.

**Routes to:** `welcome` (qualification-flow Node 1) on positive reply.

**V1 — Warmest:**
> Hi {first_name}, Robin here, founder of CryptoGameplan. We run a systematic crypto portfolio program for non-finance professionals with serious capital in the market.
>
> Worth a short conversation if that's a space you operate in?

**V2 — +10% colder:**
> Hi {first_name}. Robin from CryptoGameplan. We run a systematic crypto portfolio program for non-finance professionals with capital deployed in crypto.
>
> Worth a short conversation?

**V3 — +50% colder:**
> {first_name}, Robin from CryptoGameplan. Systematic crypto portfolio program for non-finance professionals with capital deployed.
>
> Worth a short conversation?

**Final:**
> _To be locked in by Robin._

### Trigger A — variant for prospects already following Robin

**When:** Cold outbound to a prospect who already follows Robin or is a 1st-degree connection. The "no prior interaction" still holds, but the prospect has self-selected.

**V1 — Warmest:**
> Hi {first_name}, saw you've been following the CGP content for a while. Robin here. We run a systematic crypto portfolio program for non-finance professionals with capital deployed in crypto.
>
> Worth a short conversation if that's relevant for where you are right now?

**V2 — +10% colder:**
> Hi {first_name}, Robin here. CGP runs a systematic crypto portfolio program for non-finance professionals with capital deployed.
>
> Worth a short conversation if that's relevant?

**V3 — +50% colder:**
> {first_name}, Robin from CGP. Systematic crypto portfolio program, non-finance professionals, capital deployed.
>
> Worth a short conversation?

**Final:**
> _To be locked in by Robin._

---

## Trigger B — CTA reply ("system")

**When:** Lead replies to Robin's public CTA ("DM me 'system' and I'll send the free walkthrough") with the keyword or close variant ("send me system", "I want the system", "system please").

**Principle:** They asked for the walkthrough, send the walkthrough. Then bridge to the four-question screen on the same beat. They're already warm enough that a soft pivot into qualification feels natural. Skip the welcome formality.

**Routes to:** Walkthrough sent, then directly to Q1 (skip welcome).

**V1 — Warmest:**
> Hi {first_name}, here's the walkthrough: {walkthrough_link}.
>
> Walks through the system mechanics end to end, worth setting twenty minutes aside for it. While I have you, four quick questions tell me whether CGP fits your situation. Mind if I run them?

**V2 — +10% colder:**
> Hi {first_name}, here you go: {walkthrough_link}.
>
> Covers the system end to end. While I have you, four questions tell me whether CGP fits. Mind if I run them?

**V3 — +50% colder:**
> {walkthrough_link}.
>
> Covers the system end to end. Four questions tell me whether CGP fits. Mind if I run them?

**Final:**
> _To be locked in by Robin._

### Trigger B — handling silence after the walkthrough

If the lead messages "system", receives the walkthrough, and goes silent (no acknowledgment, no engagement), the lead is not parked yet. Treat as a 24h value_touch candidate, but the walkthrough is already in their inbox, so the next touch swaps to the quiz. See [follow-up-patterns.md](follow-up-patterns.md).

---

## Trigger C — Post engagement reply

**When:** Lead leaves a substantive comment on one of Robin's LinkedIn posts (asks a question, agrees with a specific point, shares their own situation). The AI moves the conversation into DMs.

**Principle:** Reference the comment specifically, but briefly. Avoid flattery ("great point!"), avoid over-explaining. The DM continues the thread of the comment and offers the four-question screen as the next step.

**Routes to:** `welcome` (qualification-flow Node 1) on positive reply.

**V1 — Warmest:**
> Hi {first_name}, picking up your comment on the [post topic] post. Worth taking that thread into a DM if you're running serious capital in crypto. We screen with four short questions to see if CGP is the right fit. Mind if I run them?

**V2 — +10% colder:**
> Hi {first_name}, picking up your comment on the [post topic] post. If you're running serious capital, four short questions tell me whether CGP fits. Mind if I run them?

**V3 — +50% colder:**
> {first_name}, on your comment on the [post topic] post: four short questions tell me whether CGP fits if you're running serious capital. Mind if I run them?

**Final:**
> _To be locked in by Robin._

### Trigger C — variant for comments that asked a specific question

When the comment was a question (not a general observation), answer the question briefly first within compliance limits, then bridge.

**V1 — Warmest:**
> Hi {first_name}, on your question about [topic]: [one-sentence answer that doesn't violate compliance]. Worth taking the rest into a DM. Four short questions tell me whether CGP is the right fit. Mind if I run them?

**V2 — +10% colder:**
> Hi {first_name}, on your question about [topic]: [one-sentence answer]. Four questions tell me whether CGP fits. Mind if I run them?

**V3 — +50% colder:**
> {first_name}, on [topic]: [one-sentence answer]. Four questions tell me whether CGP fits. Mind if I run them?

**Final:**
> _To be locked in by Robin._

---

## Trigger D — Lead-magnet completer

**When:** Lead completes the gameplan quiz or downloads the ebook and reaches DMs (either replied to a follow-up email link, or the AI follows up directly via LinkedIn after a CRM trigger). They've shown intent but haven't asked for a call.

**Principle:** Acknowledge the completion, bridge to qualification. They've already invested time in the quiz, so they're warmer than cold outbound. Skip the welcome formality.

**Routes to:** Bridge directly to Q1 (skip welcome).

**V1 — Warmest:**
> Hi {first_name}, saw you went through the gameplan quiz. The next useful step is four short questions on my side, then I can give you a real read on whether CGP fits your situation. First one: how long have you been investing in crypto?

**V2 — +10% colder:**
> Hi {first_name}, saw you went through the quiz. Four short questions on my side, then I can give you a real read on fit. First one: how long have you been investing in crypto?

**V3 — +50% colder:**
> {first_name}, saw you went through the quiz. Four short questions, then I can give you a real read on fit. How long have you been investing in crypto?

**Final:**
> _To be locked in by Robin._

---

## Routing rules

After the opener is sent, the AI watches for one of three response shapes:

1. **Positive engagement** (any acknowledgment, agreement, or reciprocal question) → route to the node specified in the trigger row above.
2. **Skeptical pushback** ("how do I know this isn't a scam," "what makes you different") → handle via [../sales/objection-bank.md](../sales/objection-bank.md) Objection 4 (skepticism), then return to the qualification flow.
3. **Disengage.** If the lead explicitly said no, polite close, conversation ends. If silent for 24h, route to value_touch #1 (see [follow-up-patterns.md](follow-up-patterns.md)).

The AI never re-sends an opener. One opener per lead per trigger event. If the lead doesn't engage and goes silent, the value_touch is the next move, never a second opener.

---

## What the opener is NOT doing

- Not pitching CGP (the four questions decide if there's a fit; the call decides if there's a sale)
- Not naming a price, performance figure, or prediction
- Not flattering the prospect's profile, posts, or career
- Not running multiple variants in parallel as a test (the AI runs the canonical Final from each trigger row, period)
- Not asking more than one question
- Not stacking compliments before the question
- Not faking shared connection ("we have X in common")

---

## Pre-send opener scan

Before any opener goes out, run the standard pre-send scan from [../personal-voice/banned-phrases.md](../personal-voice/banned-phrases.md). Plus opener-specific:

1. **Performance / prediction / pricing scan.** Any number, percentage, return claim, price hint? If yes, rewrite. Compliance ([../personal-voice/compliance-guardrails.md](../personal-voice/compliance-guardrails.md)) applies fully to the opener.
2. **Profile-mining scan.** Does the message reference a specific job title, company, post content, or follower-count detail in a way that reads as scraped? If yes, soften or remove.
3. **Trigger match.** Does the opener match the actual trigger? (E.g. don't use Trigger D if the lead didn't actually complete the quiz.)
4. **Single question check.** One question, ending the message. Not two.
5. **Em-dash scan.** Search for `—`. Zero tolerance.

If any step fails, rewrite from scratch.

---

## How to use this doc (for Robin)

1. Read V1, V2, V3 for each trigger.
2. Pick the tone that matches what you want the AI to sound like in that scenario. You don't have to pick the same temperature for every trigger; cold outbound (Trigger A) and CTA-reply (Trigger B) might run different temperatures because the contexts are different.
3. Paste your chosen version (or a tweaked version) into the `**Final:**` slot.
4. Once every Final slot is filled, this becomes the canonical opener library and the AI runs only Finals.

## Notes

- Same register rules as the qualification flow: no "Great!", no "Looking forward to it!", no "just following up", no "if you want", one question per message, assumed-close language.
- You can write a fourth version in any Final slot if none of V1/V2/V3 nails it. The slot is yours.
- Volume, cadence, and LinkedIn-account-safety (action limits per day, randomization, HITL checkpoints) are not in this doc; those are operational settings, see project-level config.
- The `{walkthrough_link}` URL is currently a placeholder. Robin to confirm the asset and add it to [../links.md](../links.md). Until then, the AI uses the same placeholder used in qualification-flow Node 3.
