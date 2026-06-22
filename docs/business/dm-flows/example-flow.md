# Example DM Flow (for Robin)

A concrete end-to-end example of how the AI runs a LinkedIn conversation, from cold
outbound to a booked call. Voice and rules per `../personal-voice/`. This is illustrative
copy (we A/B-test variants); the structure is what's locked.

Behind every message: answers are written to the GHL contact fields, and a qualified lead
becomes an Opportunity in the Leads pipeline.

---

## Example 1 — strong fit, books a call

**AI:** Hi Daniel, Robin here, founder of CryptoGameplan. We run a systematic crypto portfolio program for non-finance professionals with serious capital in the market. Worth a short conversation if that's a space you operate in?

**Daniel:** yeah sure, been in crypto a while. what is it exactly?

**AI:** Happy to share. Before I do, a few quick questions to see if it's the right fit. First one, how long have you been investing in crypto?

**Daniel:** about 4 years now

**AI:** Alright got it, 4 years in. What's the main thing you're trying to improve in how you manage your portfolio?

**Daniel:** honestly I don't really have a system, I buy and sell on gut feeling

**AI:** Makes sense. Why that specifically?

**Daniel:** did well last run but gave most of it back. want to stop repeating that

**AI:** Last one. Roughly, how much do you have deployed in crypto right now, or planning to deploy?

**Daniel:** around 150k

**AI:** Based on those four answers, there's a potential for a fit.

Best next step is a call. I'll analyze your strategy in more depth, and we will uncover what needs to change in order for you to manage your portfolio in the most professional way. After that, if it makes sense for you, I'll walk you through exactly how our system works. So either way you walk away with clarity around your current investment situation.

Should we book that call?

**Daniel:** yeah let's do it

**AI:** Alright, I'll set up the call. What's the best email for the calendar invite?

**Daniel:** daniel.k@gmail.com

**AI:** Here you go: https://www.crypto-gameplan.com/booking?name=Daniel

Book any slot that works for you.

> **In GHL:** contact created with Experience Level `3 to 5 years`, Biggest Challenge `no system, trades on gut`, Desired Outcome `stop giving back gains`, Portfolio Value `$100,000 - $250,000`, Qualification Status `Qualified`, email saved. Opportunity created in **Leads** pipeline at stage **Qualified**, moves to **Sales Call Booked** when Daniel books. Name is pre-filled on the booking page; he just adds email/phone.

---

## Example 2 — capital too low, polite close (no link)

**AI:** … Last one. Roughly, how much do you have deployed in crypto right now, or planning to deploy?

**Prospect:** maybe 5k right now

**AI:** Appreciate you going through those. To be honest: at that capital level, the program's format doesn't fit yet, the structure is built around a different range. I'll send you the free walkthrough instead, which is the better starting point: https://crypto-gameplan.com

> **In GHL:** answers saved on the contact, Qualification Status `Not Qualified`. **No opportunity** created, **no booking link**. Conversation ends graciously.

---

## What stays consistent

- One question per message, the AI reads back answers, never pitches before the screen is done.
- Never discusses price in DMs (price is for the call).
- Never sends the booking link before the four questions are answered.
- No hype, no performance claims, no predictions (compliance).
- Messages vary in phrasing so it reads organic, not template-stamped.
