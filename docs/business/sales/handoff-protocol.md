# Handoff Protocol

What the AI does when it successfully qualifies a lead and hands them to Robin. Minimal scope: booking, transcript, tag. No CRM push (attribution is handled separately via a UTM parameter on the LinkedIn booking link).

---

## The handoff is a booking, not a message chain

When a qualified prospect books via the booking link, the handoff is complete. Robin sees the booking in his calendar. The AI is done.

No Slack ping. No email notification. No real-time push. The booking itself is the signal.

---

## What the AI logs (for Robin's pre-call prep)

For every lead that reaches the pitch_call node or later, the AI writes a single record containing:

1. **Prospect identity**
   - LinkedIn profile URL
   - First name
   - Any profile data extracted (job title, company, location)

2. **The four qualification answers**
   - Q1 — experience (years in crypto, cycles seen)
   - Q2 — what they're trying to improve
   - Q3 — why that, specifically
   - Q4 — capital deployed or planned

3. **Soft signals**
   - Did the prospect need the "deployed → invested" vocabulary swap? (indicates less experience than ICP)
   - Did the prospect try to skip to pricing? (indicates higher commercial readiness)
   - Did any of the polite-exit patterns appear ("let me think about it," spouse reference)? (indicates lower commitment)
   - Did the prospect push back skeptically? (indicates serious ICP — burned-investor profile)

4. **Fit tag (assigned at pitch_call node)**
   - Strong fit
   - Borderline
   - Weak fit → routed to lead magnet, not pitched
   - Disqualified → polite close, conversation ended

5. **Full conversation transcript**
   - Every message in the thread, timestamped
   - In order, readable as a conversation

6. **Source attribution**
   - AI cold DM vs lead magnet vs Robin's content engagement
   - If it's from the AI outbound, which opener variant was used (once openers are built out)

---

## Where the record lives

For now: a single log file or database the AI writes to. Format is the agency's choice as long as Robin can read it.

Minimum viable: one entry per lead, appended to a running log. Robin reads the log before each strategy call.

Deeper integration (CRM sync, Slack push, automated prep emails) is explicitly out of scope for v1. A UTM parameter on the LinkedIn booking link handles the attribution side — the developer will add it, and the CRM will pick up LinkedIn-sourced bookings from there.

---

## When the AI hands off vs when it doesn't

The AI hands off (writes the record + closes its role) in these cases:
- Prospect books the call → success
- Prospect is flagged for human review at Q4 ($50k-$100k borderline) → AI books + flags
- Prospect hits an escalation trigger (see `../personal-voice/compliance-guardrails.md` rule 15) → AI pauses, writes the record, hands immediately

The AI does NOT hand off in these cases:
- Lead is parked (ghosted, weak fit, disqualified, refused qualification) → no call, no handoff, no record beyond a brief parked note
- Lead is mid-qualification → no handoff yet, AI keeps running

---

## The AI's final message when handing off

Once the booking link is sent (qualification-flow Node 11), the AI's role is done. The AI does NOT:

- Send a "looking forward" message
- Try to build rapport before the call
- Send reminders more than the one documented in qualification-flow (Node 11b, 72h reminder)
- Engage if the prospect messages between booking and the call, unless it's a scheduling issue

If the prospect messages between booking and the call with a non-scheduling question:
> Best to cover that on the call itself — Robin can give you a proper answer there. See you at [time].

Exception: scheduling changes (reschedule, cancellation). The AI handles those routinely by updating the booking.

---

## What Robin sees pre-call

Before the strategy call, Robin reads the record and walks in with:
- Who the prospect is
- The full picture from Q1-Q4
- Any soft signals flagged
- The fit tag
- The transcript (in case a specific exchange matters)
- Attribution source (LinkedIn AI vs lead magnet vs content)

Nothing else. No secondary calls. No pre-call emails. The call is the next touchpoint.

---

## What happens if a lead re-engages after being parked

If a parked lead comes back into the DMs on their own:
- If they re-initiate interest → the AI restarts the qualification flow from the welcome node, using the previous transcript as context
- If they share relevant new information ("I now have $200k, ready to talk") → the AI routes them straight to the pitch if the other ICP signals hold
- If they ask an unrelated question → answer briefly and return to the welcome if appropriate

Leads who are re-engaging are typically higher-intent than fresh leads. Treat them as warm.

---

## What happens if Robin needs to intervene mid-flow

Robin can take over any AI-run thread at any time. The AI detects Robin sending a message directly and stops. When Robin hands back, the AI picks up with whatever state the conversation is in.

If Robin messages a prospect directly during qualification, the AI logs this and does not resume that specific node — Robin owns that turn. The AI only rejoins once Robin explicitly flags "back to the AI" or after a defined silence period.

---

## Summary

The handoff is simple:
1. Prospect books → Robin sees the booking
2. AI writes the record (identity, four answers, soft signals, fit tag, transcript, source)
3. AI stops
4. Robin reads the record before the call
5. Robin takes the call

No CRM sync in v1. No real-time notifications. UTM parameter handles source attribution. Everything else is manual.
