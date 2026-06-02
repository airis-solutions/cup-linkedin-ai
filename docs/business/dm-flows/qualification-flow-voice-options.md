# Qualification Flow — Voice Options

Three versions of every message in the LinkedIn qualification flow, ranked by temperature:

- **V1 — Warmest** (current baseline, professional-polite)
- **V2 — +10% colder** (one warmth signal stripped)
- **V3 — +50% colder** (most warmth stripped, purely professional)

Read each message in all three tones. Below each, paste the final version we lock in. Once every `**Final:**` slot is filled, that becomes the canonical copy set for [qualification-flow.md](qualification-flow.md).

The structure, routing, and register rules don't change across versions — only the copy inside each message.

---

## Node 1 — welcome

**When:** Lead just opened contact.

**V1 — Warmest (current):**
> Hi {first_name}, happy to share more on CGP.
>
> Before I do, is it okay if I ask a few quick questions? Just want to make sure it's actually the right fit for you before we get into specifics. Takes a couple of minutes.

**V2 — +10% colder:**
> Hi {first_name}, happy to share more on CGP. Before I do, is it okay if I ask a few quick questions to see if it's the right fit?

**V3 — +50% colder:**
> Hi {first_name}. Before I share more on CGP, okay if I ask a few quick questions to check fit?

**Final:**
> Hi {first_name}, happy to share more on CGP. Before I do, I need to ask a few quick questions to see if it's the right fit?

---

## Node 2 — objection_price

**When:** Lead asks about price or sign-up before going through the screen.

**V1 — Warmest (current):**
> Fair question. Pricing depends on which format actually fits your situation, which is what the four questions help figure out. I'd rather give you a clear answer than a vague one. Still good to run through them?

**V2 — +10% colder:**
> Fair question. Pricing depends on which format fits your situation, which is what the four questions figure out. Good to run through them?

**V3 — +50% colder:**
> Pricing depends on the format that fits your situation. The four questions decide that. Good to run through them?

**Final:**
> Fair question. Pricing depends on which format fits your situation, which is what the four questions figure out. Should we run through them real quick?

---

## Node 3 — value_touch (re-engage after 24h silence)

**When:** Lead didn't respond to welcome within 24h. Framing rule: always "my action → their benefit," never reference their silence or prior messages.

**V1 — Warmest (current):**
> Hi {first_name}, I was reading back through this walkthrough and thought it might actually be useful for you: [link to free ebook / walkthrough].
>
> Worth a look whenever you've got a moment.

**V2 — +10% colder:**
> Hi {first_name}, was reading through this walkthrough and thought it might be useful for you: [link].
>
> Worth a look.

**V3 — +50% colder:**
> {first_name}, was reading through this walkthrough, thought it'd be useful for you: [link].

**Final:**
> Hi {first_name}, was reading through this walkthrough and thought it might be useful for you: [link].
>
> Worth a look.

### Node 3b — re-engage after value_touch reply (assumed close, no pussy-out)

**V1 — Warmest (current):**
> Glad it's useful. Let's pick up the four questions so I can give you a read on whether CGP fits: how long have you been in crypto?

**V2 — +10% colder:**
> Glad it's useful. Let's pick up the four questions: how long have you been in crypto?

**V3 — +50% colder:**
> Picking up the four questions: how long have you been in crypto?

**Final:**
> Glad it's useful. Saw we didn't continue the questions in regards to CGP. Let's pick them up where we stopped last time: How long have you been in crypto?

---

## Node 4 — Q1 (experience)

**V1 — Warmest (current):**
> Got it. First one: how long have you been investing in crypto?

**V2 — +10% colder:**
> Got it. How long have you been investing in crypto?

**V3 — +50% colder:**
> How long have you been investing in crypto?

**Final:**
> First one, how long have you been investing in crypto?

---

## Node 5 — Q2 (what to improve)

**V1 — Warmest (current):**
> Got it. And the main thing you're trying to improve in how you run your portfolio right now?

**V2 — +10% colder:**
> Got it. Main thing you're trying to improve in how you run your portfolio?

**V3 — +50% colder:**
> Main thing you're trying to improve in how you run your portfolio?

**Final:**
> READ BACK THEIR ANSWER (F.e. "Alright got it, 2 years since you started looking into crypto). What's the main thing you're trying to improve in how you manage your portfolio?

---

## Node 6 — Q3a (why that)

**V1 — Warmest (current):**
> Makes sense. Why that specifically?

**V2 — +10% colder:**
> Makes sense. Why that?

**V3 — +50% colder:**
> Why that?

**Final:**
> Makes sense. Why that specifically?

---

## Node 7 — Q4 (portfolio size)

**V1 — Warmest (current):**
> Last one. Roughly, how much do you have deployed in crypto right now, or planning to deploy?

**V2 — +10% colder:**
> Last one. How much do you have deployed in crypto, or planning to deploy?

**V3 — +50% colder:**
> How much do you have deployed in crypto?

**Final:**
> Last one. Roughly, how much do you have deployed in crypto right now, or planning to deploy?

### Node 7b — if prospect questions "deployed" (do NOT explain, swap to "invested")

**V1 — Warmest (current):**
> Roughly, how much do you have invested in crypto right now, or planning to invest?

**V2 — +10% colder:**
> How much do you have invested in crypto, or planning to invest?

**V3 — +50% colder:**
> How much invested in crypto?

**Final:**
> READ BACK THEIR ANSWER (F.e. "ah no worries, deploying = investing"), so how much do you have invested in crypto right now, or planning to invest?

### Node 7c — soft close for <$50k capital

**V1 — Warmest (current):**
> Appreciate you going through those. To be honest: at that capital level, the program's format doesn't fit yet, the structure is built around a different range. I'll send you the free walkthrough instead, which is the better starting point: [link].

**V2 — +10% colder:**
> Honest read: at that capital level, the program's format doesn't fit yet — the structure is built around a different range. Sending the free walkthrough instead, which is the better starting point: [link].

**V3 — +50% colder:**
> Straight read: at that capital level, the program doesn't fit yet — wrong structure for the range. Better starting point is the free walkthrough: [link].

**Final:**
> Appreciate you going through those. To be honest: at that capital level, the program's format doesn't fit yet, the structure is built around a different range. I'll send you the free walkthrough instead, which is the better starting point: [link].

---

## Node 9 — pitch_call (assumed close)

**V1 — Warmest (current):**
> Based on those four, there's a fit. Best next step is a short call. I'll walk you through exactly how the system runs, how we'd work together, and you'll leave with a clear read on whether it makes sense either way. Sending the booking link now.

**V2 — +10% colder:**
> Based on those four, there's a fit. Next step is a short call — I walk you through how the system runs, how we'd work together, and you leave with a clear read either way. Sending the booking link now.

**V3 — +50% colder:**
> Based on those four, there's a fit. Next step is a short call. Sending the booking link now.

**Final:**
> Based on those four answers, there's a potential for a fit. 

> Best next step is a call. I'll analyze your strategy in more depth, and we will uncover what needs to change in order for you to manage your portfolio in the most professional way. After that, if it makes sense for you, I'll walk you through exactly how our system works, how work together would look like. So either way you walk away with clarity around your current investment situation.

> Should we book that call?

---

## Node 10 — hesitant

**When:** Prospect expresses unease about the call.

**V1 — Warmest (current):**
> No pressure. The call is assessment, not pitch. We walk through your situation, I give you a straight read on whether CGP is the right move, you decide from there. No drawn-out sales sequence after, either way.

**V2 — +10% colder:**
> The call is assessment, not pitch. We walk through your situation, I give you a straight read on whether CGP is the right move, you decide from there. No sales sequence after.

**V3 — +50% colder:**
> The call is assessment, not pitch. Straight read on fit, you decide from there. No sales sequence after.

**Final:**
> The call is assessment, not a pitch. We walk through your situation, I give you a clear read on whether CGP is the right move, and you decide from there.

> Should we book that call?

---

## Node 11 — send_link

**V1 — Warmest (current):**
> Here you go: {booking_link}
>
> Grab any slot that works for you.

**V2 — +10% colder:**
> {booking_link} — grab any slot that works.

**V3 — +50% colder:**
> {booking_link}

**Final:**
> Here you go: {booking_link}

> Book any slot that works for you.

### Node 11b — 72h booking reminder

**V1 — Warmest (current):**
> Hi {first_name}, slot availability tends to tighten toward the weekend. Worth grabbing one now: {booking_link}

**V2 — +10% colder:**
> {first_name}, slots tighten toward the weekend. Worth grabbing one now: {booking_link}

**V3 — +50% colder:**
> Slots tighten toward the weekend: {booking_link}

**Final:**
> Did you have any technical difficulties with the link?

---

## Node 12 — disqualified close

**When:** Signals misalignment (chasing 10x, signals-only, heavy leverage, <$50k capital).

**V1 — Warmest (current):**
> Straight read: CGP isn't the right fit for that situation right now. If anything changes, the door's open.

**V2 — +10% colder:**
> Straight read: CGP isn't the right fit for that situation. If anything changes, door's open.

**V3 — +50% colder:**
> CGP isn't the right fit for that situation.

**Final:**
> CGP isn't the right fit for that situation.

---

## How to use this doc

1. Read V1, V2, V3 for each node.
2. Pick the tone that matches what you want the AI to sound like on LinkedIn. You don't have to pick the same version for every node — some may be warmer, some colder.
3. Paste your chosen version (or a tweaked version) into the `**Final:**` slot.
4. Once every final slot is filled, I'll build the canonical [qualification-flow.md](qualification-flow.md) using only the final copy.

## Notes

- The structure and routing logic stay identical across versions — only the copy inside each message changes.
- You can also write a fourth version in any Final slot if none of V1/V2/V3 nails it. The slot is yours.
- Register rules still apply to whatever version you pick: no "Great!", no "Looking forward to it!", no "just following up", no "if you want", one question per message, assumed-close language, value-touch framing on re-engages.
