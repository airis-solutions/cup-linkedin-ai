# Follow-up Patterns (LinkedIn)

How the AI re-engages a silent thread, what gets sent at each interval, and when the AI stops chasing. Three versions of every new follow-up message, ranked by temperature, mirroring [qualification-flow-voice-options.md](qualification-flow-voice-options.md):

- **V1 — Warmest** (professional-polite baseline)
- **V2 — +10% colder** (one warmth signal stripped)
- **V3 — +50% colder** (most warmth stripped, purely professional)

Voice rules from [../personal-voice/tone.md](../personal-voice/tone.md) and [../personal-voice/banned-phrases.md](../personal-voice/banned-phrases.md) apply to every version. The canonical 24h re-engage (`value_touch`, Node 3 in [qualification-flow.md](qualification-flow.md)) and the 72h booking reminder (Node 11b) are already locked and not re-rolled here. This file documents the surrounding cadence, the content selection logic, and the additional re-engage scenarios not covered by the qualification flow.

Variables:
- `{first_name}` — lead's first name from LinkedIn profile
- `{booking_link}`, `{walkthrough_link}`, `{quiz_link}` — see [../links.md](../links.md)

---

## Cadence overview

**Welcome-stage silence:**
```
welcome → no reply 24h → value_touch #1 (asset A)
                            │             │
                        [reply]        no reply 24h
                            │             │
                            ▼             ▼
                       re-engage     value_touch #2 (asset B)
                       (Node 3b)        │             │
                                    [reply]        no reply 72h
                                        │             │
                                        ▼             ▼
                                  custom re-engage  parked
```

**Mid-qualification silence (Q1, Q2, or Q3 answered, then no reply):**
```
Q-sequence → no reply 24h → mid-qualification re-engage (asset A)
                                │
                          no reply 24h
                                │
                                ▼
                             parked
```

**Booking-stage silence:**
```
send_link → no booking 72h → Node 11b reminder
                                  │
                            no booking 72h
                                  │
                                  ▼
                               parked
```

**Hard limits (already in [qualification-flow.md](qualification-flow.md), not relaxed here):**
- Max two value_touches per lead. After the second, parked.
- Mid-qualification re-engage runs once. After that, parked.
- 72h booking reminder runs once. After that, parked.

---

## The framing rule (every follow-up, no exceptions)

Every re-engage message is framed as **something Robin did** that reminded him of the lead. Never as something the lead did or didn't do.

**Banned framings:**
- "Just following up"
- "Just checking in"
- "Did you see my last message"
- "Wanted to bump this"
- "Haven't heard back"
- Anything that names the silence

**Allowed framings:**
- "Was reading through this..."
- "Came across this and thought..."
- "Recorded a walkthrough on..."
- "Posted something on [topic]..."

Reason: any reference to silence is admission of chasing, and chasing inverts status. See [../personal-voice/tone.md](../personal-voice/tone.md) §value-touch framing.

---

## Content selection — which asset for which touch

The AI rotates through public assets so each touch carries different value. The same asset is never sent twice to the same lead.

| Touch | Default asset | Why |
|---|---|---|
| value_touch #1 (24h after welcome silent) | Walkthrough (`{walkthrough_link}`) | Closest to "what is CGP", fills the gap the welcome was about to fill |
| value_touch #2 (24h after #1 silent) | Quiz (`{quiz_link}`) or a specific Robin post / YouTube episode | Different format, lower-friction, lets the lead self-discover fit |
| Mid-qualification re-engage (24h after Q1/Q2/Q3 silent) | Walkthrough (`{walkthrough_link}`) | Same asset as value_touch #1 because the lead hasn't seen it yet |
| Parked re-engage (lead returns weeks later) | None — restart from welcome | They came back on their own, no value-touch needed |

**Asset already received:** if the lead got the walkthrough at the opener (Trigger B in [opener-patterns.md](opener-patterns.md)), value_touch #1 and the mid-qualification re-engage swap to the quiz instead. Don't send the same link twice.

---

## value_touch #1 (24h after welcome silent) — already canonical

Locked in [qualification-flow.md](qualification-flow.md) Node 3:

> Hi {first_name}, was reading through this walkthrough and thought it might be useful for you: [link].
>
> Worth a look.

The re-engage on reply (Node 3b) is also locked:

> Glad it's useful. Saw we didn't continue the questions in regards to CGP. Let's pick them up where we stopped last time: How long have you been in crypto?

No new copy needed for this slot.

---

## value_touch #2 (24h after value_touch #1 silent)

**When:** Lead didn't reply to welcome, didn't reply to value_touch #1 24h later. This is the last touch before parking.

**Asset:** different from value_touch #1. Default: quiz. Substitute: a specific Robin LinkedIn post or YouTube episode if Robin pins one for this slot.

**Principle:** softer than #1. The lead is signaling fade. Don't escalate, don't re-pitch. Drop one more piece of value, then close the door politely.

**Routes to:** if reply → custom re-engage (below). If silent another 72h → parked.

**V1 — Warmest:**
> Hi {first_name}, recorded a quick gameplan quiz that surfaces where most people are over- or under-positioned. Worth two minutes if you're curious: {quiz_link}.

**V2 — +10% colder:**
> Hi {first_name}, this quiz surfaces where most people are over- or under-positioned: {quiz_link}.
>
> Two minutes.

**V3 — +50% colder:**
> Quiz that surfaces over- and under-positioning, two minutes: {quiz_link}.

**Final:**
> _To be locked in by Robin._

### value_touch #2 — re-engage on reply

If the lead engages with the second value_touch (replies, asks a question, comments on the asset), the AI re-engages with a one-line callback to the qualification, no apology for the gap.

**V1 — Warmest:**
> Glad you ran it. Worth picking up the four questions to see if CGP fits properly. How long have you been in crypto?

**V2 — +10% colder:**
> Glad you ran it. Picking up the four questions: how long have you been in crypto?

**V3 — +50% colder:**
> Picking up the four questions: how long have you been in crypto?

**Final:**
> _To be locked in by Robin._

---

## Mid-qualification re-engage (new node)

**When:** Lead has answered welcome and is mid-flow (Q1, Q2, or Q3 answered) but goes silent for 24h before the next question.

**Why this is a separate pattern:** the canonical value_touch (Node 3) is shaped for a lead who never got past welcome. Mid-flow leads have already shown they'll engage with the four questions, so the re-engage carries one extra signal: a callback to where the conversation actually was.

**Asset:** walkthrough (the lead hasn't seen it yet at this point).

**Routes to:** the next un-answered question in the flow. The AI READ-BACKs the lead's last answered question, then asks the next one in sequence (mirrors the Node 3b pattern).

**V1 — Warmest:**
> Hi {first_name}, was reading back through this walkthrough and thought it might be useful for you while we pick this up: {walkthrough_link}.
>
> When you've got a minute, ready to keep going where we stopped?

**V2 — +10% colder:**
> Hi {first_name}, was reading through this walkthrough, worth a look while we pick this up: {walkthrough_link}.
>
> Ready to keep going where we stopped?

**V3 — +50% colder:**
> {first_name}, this walkthrough is worth a look: {walkthrough_link}.
>
> Ready to pick up where we stopped?

**Final:**
> _To be locked in by Robin._

### Mid-qualification re-engage — example of READ-BACK on reply

If the lead went silent after answering Q2, on reply the AI says (paraphrased pattern, not canonical copy):

> Glad it's useful. READ BACK their Q2 answer (e.g. "process and consistency, that's what most people land on too"). Why that specifically?

The "Why that specifically" is Q3, the next un-answered question. Same pattern applies if the lead silenced after Q1 (next question is Q2) or after Q3 (next question is Q4). The READ-BACK rule from [qualification-flow.md](qualification-flow.md) §register-rules still governs.

---

## Parked re-engage (when a parked lead returns)

**When:** A previously parked lead initiates a new message in the DM thread. Could be weeks or months after parking. They came back on their own.

**Principle:** parked leads who self-return are higher-intent than fresh leads. Treat them as warm. No "long time no see," no acknowledgment of the gap. Pick up as if the conversation just paused.

Three sub-cases.

### Sub-case 1 — Lead re-initiates with general interest

The lead messages something like "still thinking about CGP" or "ready to talk now" or just "hey." Restart welcome.

**V1 — Warmest:**
> Hi {first_name}, glad you're back. Same screen runs the same way: four quick questions to see if it's the right fit. Mind if I run them?

**V2 — +10% colder:**
> Hi {first_name}. Four quick questions to see if it's the right fit. Mind if I run them?

**V3 — +50% colder:**
> {first_name}. Four questions, fit screen. Run them?

**Final:**
> _To be locked in by Robin._

### Sub-case 2 — Lead re-initiates with new information

The lead shares a meaningful update ("I now have $200k in," "I've been through another cycle," "I'm ready to do this"). If the new info plus the previous transcript covers Q1–Q3 implicitly, route directly to Q4. If not, restart welcome.

(See [handoff-protocol.md](../sales/handoff-protocol.md) §re-engagement: "if they share relevant new information, the AI routes them straight to the pitch if the other ICP signals hold.")

**V1 — Warmest:**
> Got it, that changes things. Last screening question is the capital one: roughly, how much do you have deployed in crypto right now, or planning to deploy?

**V2 — +10% colder:**
> Got it. Capital question: how much do you have deployed in crypto, or planning to deploy?

**V3 — +50% colder:**
> Capital question: how much deployed in crypto, or planning to deploy?

**Final:**
> _To be locked in by Robin._

### Sub-case 3 — Lead re-initiates with an unrelated question

The lead asks about something tangential ("read your post on liquidity, what do you think about X"). Answer briefly within compliance limits, then offer the screen.

**V1 — Warmest:**
> [One-sentence answer, compliance-safe]. Worth running the four questions if you want a real read on fit. Mind if I run them?

**V2 — +10% colder:**
> [One-sentence answer]. Four questions if you want a real read on fit. Mind if I run them?

**V3 — +50% colder:**
> [One-sentence answer]. Four questions for a fit read. Run them?

**Final:**
> _To be locked in by Robin._

---

## Booking-stage follow-ups (between send_link and the call)

The lead has the booking link but hasn't booked yet.

### 72h booking reminder (Node 11b — already canonical)

> Did you have any technical difficulties with the link?

(Locked in [qualification-flow.md](qualification-flow.md) Node 11b.) The framing is technical, not emotional. Gives the lead a frictionless out without admitting hesitation. If they say "yes, the link was broken," resend. If they say "no, just haven't gotten to it," the AI does NOT push further. Silent for another 72h, then parked.

### Booked but not arrived (no-show on call)

Out of the AI's scope. Robin handles no-shows manually. The AI does not send a "sorry we missed you" or rebook attempt unless Robin explicitly hands it back.

---

## When the AI does NOT follow up

The AI sends zero follow-ups in any of the following:

1. Lead is **disqualified** (Node 12). Conversation closed.
2. Lead is **<$50k soft-closed** (Node 7c). Walkthrough was sent at the close. Done.
3. Lead **explicitly declined** ("not interested," "please stop messaging"). Done. No "if anything changes, the door's open" — that's still chasing.
4. Lead **booked the call.** AI's job is finished at booking. Only re-engages on scheduling issues.
5. **Compliance escalation** triggered (see [../personal-voice/compliance-guardrails.md](../personal-voice/compliance-guardrails.md) §15). AI hands to Robin, no follow-up from the AI.
6. **Robin took over the thread** manually. AI stops until Robin hands back.

---

## Pre-send follow-up scan

Before any follow-up message goes out, run the standard pre-send scan from [../personal-voice/banned-phrases.md](../personal-voice/banned-phrases.md). Plus follow-up-specific:

1. **Silence-reference scan.** Does the message reference the gap, the silence, or a prior unanswered message? If yes, rewrite. Zero tolerance.
2. **Asset duplication scan.** Has this lead already received the asset I'm about to send? If yes, swap to a different asset.
3. **Touch count check.** Is this the third value_touch in the thread? If yes, do not send. Park instead.
4. **Compliance check.** Same rules as the rest of the flow ([../personal-voice/compliance-guardrails.md](../personal-voice/compliance-guardrails.md)).
5. **Em-dash scan.** Zero tolerance.

If any step fails, rewrite or skip the message entirely.

---

## How to use this doc (for Robin)

1. Read V1, V2, V3 for each new follow-up.
2. Pick a tone for each. You can mix temperatures across follow-ups (e.g. cold for value_touch #2, warmer for parked re-engage).
3. Paste your chosen version (or a tweaked version) into the `**Final:**` slot.
4. Confirm or adjust the content-selection table (which asset for which touch).
5. Once every Final slot is filled, this becomes the canonical follow-up library.

## Notes

- The 24h-then-72h timing is set by the canonical flow. Don't shorten the gap; it reads as chasing.
- value_touch #2 should always carry a *different* asset than #1. Even if Robin loves the walkthrough, sending it twice undermines the framing.
- The `{walkthrough_link}` URL is currently a placeholder. Robin to confirm the asset and add it to [../links.md](../links.md). Until then, the AI uses the same placeholder used in qualification-flow Node 3.
