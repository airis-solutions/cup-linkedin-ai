# Objection Bank (DM stage)

Objections that show up in DMs *before* the strategy call, and how the AI handles each one. Call-stage objections (spouse, liquidity, "I need to think about it") are Robin's job on the call, not the AI's. Those are documented separately in `objections/CGP Core Objections and Psychology.md` for Robin's call prep.

Voice rules from `../personal-voice/tone.md` and `../personal-voice/banned-phrases.md` apply to every response here. In particular: assumed close, no "if you want," no "just following up," register mixing, one question per message.

---

## Objection 1 — "What's the price?" (before qualifying)

Already handled in `../dm-flows/qualification-flow.md` Node 2 (objection_price). Summary:

**Principle:** Pricing depends on format, and format depends on the screen. Running the screen first produces a better answer than guessing.

**Canonical response:**
> Fair question. Pricing depends on which format fits your situation, which is what the four questions figure out. Should we run through them real quick?

**If they still push for price only:** route to parked. Do not send a price in DMs under any circumstance. See `../personal-voice/compliance-guardrails.md` rule 9.

---

## Objection 2 — "Send me more info first"

Prospect asks for a PDF, deck, brochure, or "more information" before engaging in live conversation. Often phrased as:

- "Can you send me a deck?"
- "Do you have a PDF I can review?"
- "Send me more info first and I'll get back to you."
- "What's the program exactly? Break it down for me in writing."

**What's actually happening:** the prospect is trying to move the conversation into a zero-pressure format they can quietly exit. "Send me info" is rarely followed by a real review. It's a polite disengage dressed as a request.

**Principle:** We don't have a deck because the program depends on fit, and fit can't be assessed from a PDF. Offer the free walkthrough instead (which is already public) and steer the real conversation back toward the four questions.

**Canonical response:**
> The free walkthrough covers the system mechanics end to end: [link].
>
> Beyond that, the program itself is shaped to fit the situation of each member, so there isn't a one-size PDF that would actually answer whether CGP fits for you. That's what the four questions are built to answer.
>
> Should we run through them?

**Variants based on how the prospect pushed:**

If they're skeptical / testing:
> We run four short questions so I can give you a real read on whether CGP is a fit, rather than a generic brochure. Should we run through them?

If they're busy / short on time:
> Four questions, two minutes. Gives you a real answer instead of a PDF that wouldn't apply to you specifically.

**If they refuse the questions AND the walkthrough link:** route to parked. Don't push.

---

## Objection 3 — "I'm not ready / too early / need to build capital first"

Prospect says something like:
- "I'm not ready yet, I need to build more capital."
- "Maybe in six months once I've recovered some losses."
- "I want to wait until the next bull run before I do this."
- "I'm too early, let me get to $X first and we'll talk."

**What's actually happening:** two possibilities. Either (a) the prospect is genuinely under capital threshold and should be soft-closed to the lead magnet, or (b) the prospect has the capital but is using readiness as a polite exit. The AI's job is to disambiguate with a single question, then route.

**Principle:** We don't argue with "not ready." We test whether it's real.

**Canonical response:**
> Makes sense. Two minutes of context would tell me if "not ready" is a capital question or a timing question. Want me to ask the four questions anyway and we'll figure out what actually makes sense as a next step? If CGP isn't the move, I'll tell you straight.

**Outcomes:**

- They agree → go into Q1. The capital answer at Q4 will reveal whether it's real (<$50k → soft close to walkthrough) or polite-exit (>$100k → pitch the call, fit is there).
- They refuse → take them at their word. Route to lead magnet and park:

> Understood. The free walkthrough covers the system if you want to go deeper on your own timeline: [link].

**Do NOT:**
- Do not tell them they're ready when they're not.
- Do not pressure them with "now is actually the best time."
- Do not invoke urgency ("waiting is the most expensive thing you can do").
- Do not talk them out of a real capital constraint.

---

## Objection 4 — Skepticism / "how do I know this isn't a scam"

Prospect pattern-matches CGP to the crypto-scam category and pushes back. Phrased various ways:

- "How do I know this isn't a scam?"
- "There are a lot of guru courses out there, what makes this different?"
- "I've been burned by similar programs before."
- "What's your track record? Show me the numbers."
- "Seems too polished, what's the catch."

**What's actually happening:** this prospect is ICP. They're in the target demographic precisely because they've been burned and are now cautious. Their skepticism is a strength, not an objection to overcome. Treating it like an objection to close is the wrong move. Treating it as a reasonable question from an adult is the right move.

**Principle:** We agree with the skepticism, then show why the setup of the conversation itself is evidence. We don't argue, we don't oversell, we don't promise results.

**Canonical response (the "skepticism is correct" pattern):**
> Fair instinct to have, honestly. The space is full of people pitching returns they can't defend. A few things:
>
> 1. I'm not pitching anything in this DM. The four questions are about fit, not sales.
> 2. I don't talk returns in DMs. If we get to the call, you see the track record live, walked through.
> 3. If CGP isn't the right fit for your situation, I'll tell you straight and point you at the free walkthrough instead.
>
> Worth running the four questions?

**If the prospect asks specifically about track record / performance:**
> Not something I share numbers on in DMs, and honestly the bar for that in this space is trust-me-bro, which is part of what makes it a dumpster. On the call we walk through the track record live and you decide if it holds up.

**If the prospect names a specific competitor or bad actor:**
Do NOT discuss competitors by name. See `../personal-voice/compliance-guardrails.md` rule 8. Pivot:
> I don't talk about other programs specifically. What I can tell you is what we do — CGP is a systematic process, not a signals service, and we assess fit before we take anyone on. Worth running the four questions?

**If the prospect goes adversarial ("you're all scammers" / hostile):** disengage politely. You cannot sell someone who is committed to the scam frame:
> All good, not everyone should work with us. Leaving you with the free walkthrough in case it's useful: [link].

---

## General patterns across all four objections

### Pattern 1 — Agree first, then redirect
Never argue with the objection. Agree that the concern is reasonable. Then offer the path forward. Prospects disarm when they don't have to defend their position.

### Pattern 2 — The four questions are always the answer
At the DM stage, the four-question screen is the universal redirect. The AI's job isn't to close on LinkedIn — it's to get qualified people onto the call. Every objection resolves to either "run the four questions" or "take the walkthrough and we're done here."

### Pattern 3 — Never chase
If the prospect disengages, the AI closes with the walkthrough link as a parting gift. No follow-up. No "just checking back." See value-touch framing in `../dm-flows/qualification-flow.md` and `../personal-voice/tone.md`.

### Pattern 4 — Call anything you don't handle
The AI only handles DM-stage objections. Call-stage objections (spouse, liquidity, timing, "let me think about it") are Robin's job on the call. If a prospect surfaces one of those in DMs before the call, route to the call:
> That's a call conversation. Happy to walk through it there, but not in a DM.

### Pattern 5 — Compliance first
No performance claims, no price in DMs, no specific guarantees, no "this will pump." See `../personal-voice/compliance-guardrails.md`. If any response would violate a compliance rule, rewrite the response until it doesn't.

---

## Pre-send scan for objection responses

Before the AI sends any objection response:

1. Does it agree with the objection before redirecting? If no, rewrite.
2. Does it route to either the four questions or the walkthrough link? If no, rewrite.
3. Does it avoid naming competitors? If no, rewrite.
4. Does it avoid performance claims / specific price / guarantees? If no, rewrite.
5. Does it use assumed close, not permission language? If no, rewrite.
6. Is it short enough? If three sentences can do the job of five, cut two.

---

## For deeper psychology

The subfolder `objections/` contains `CGP Core Objections and Psychology.md`, which documents the full call-stage objection set, the "ugly truths" prospects feel but rarely say, and the "comeback trigger" pattern (lost deals returning 3-6 months later).

That doc is for Robin's call prep, not the AI. The AI works off this file only.
