/**
 * The qualification engine: a pure state machine over the canonical flow.
 *
 * advance(state, understanding, vars) processes ONE inbound message and returns the next
 * outbound message (locked copy), the next node/stage, and the qualification patch. No I/O,
 * so it is fully unit-testable. The understanding (intent + extracted fields + read-back) is
 * produced separately by the Haiku layer (classify.ts).
 */
import { FIXED_COPY, capitalTier, fill, nodeToStage, q2Message, q4SwapMessage } from './flow.js';
import { bookingLinkWithName } from '../config/ghl.js';
import type {
  BrainDecision,
  BrainEventKind,
  BrainState,
  FlowNode,
  FlowVars,
  InboundUnderstanding,
  Qualification,
} from './types.js';

const READBACK_FALLBACK = 'Got it.';
const VOCAB_SWAP_READBACK = 'ah no worries, deploying = investing,';

function decide(
  node: FlowNode,
  reply: string | undefined,
  patch: Partial<Qualification>,
  events: BrainEventKind[],
  extra: Partial<BrainDecision> = {},
): BrainDecision {
  return {
    reply,
    nextNode: node,
    nextStage: nodeToStage(node),
    qualificationPatch: patch,
    events,
    ...extra,
  };
}

function toPark(reason: BrainEventKind = 'lead_parked'): BrainDecision {
  return decide('parked', undefined, {}, [reason], { parkUntilHours: 72 });
}

/**
 * Not a potential customer at all (vendor/agency pitch, recruiter, spam). Do NOT run them
 * through qualification — flag for a human, offer a short polite disengage, and route to
 * do-not-contact so the follow-up scheduler never touches them.
 */
function notProspect(vars: FlowVars): BrainDecision {
  return decide('not_prospect', fill(FIXED_COPY.not_prospect ?? '', vars), {}, ['flagged_non_prospect'], {
    flagForHuman: true,
  });
}

/** First outbound when a lead opens contact / responds to an opener. */
export function opener(vars: FlowVars): BrainDecision {
  return decide('welcome', fill(FIXED_COPY.welcome ?? '', vars), {}, []);
}

/** Process one inbound message at the current node. */
export function advance(state: BrainState, u: InboundUnderstanding, vars: FlowVars): BrainDecision {
  const { intent } = u;
  const readback = (u.readback ?? '').trim() || READBACK_FALLBACK;
  const extracted = u.extracted ?? {};

  // Hard exits available from most nodes.
  if (intent === 'not_a_prospect') return notProspect(vars);
  if (intent === 'not_interested') return toPark();

  switch (state.node) {
    case 'welcome':
      if (intent === 'wants_price') {
        return decide('objection_price', fill(FIXED_COPY.objection_price ?? '', vars), {}, [
          'objection_handled',
        ]);
      }
      // agree / answer / anything engaged -> start the screen.
      return decide('q1', fill(FIXED_COPY.q1 ?? '', vars), {}, ['qualification_advanced']);

    case 'objection_price':
      if (intent === 'wants_price') return toPark(); // insists on price only -> parked
      return decide('q1', fill(FIXED_COPY.q1 ?? '', vars), {}, ['qualification_advanced']);

    case 'q1':
    case 're_engage': {
      // Q1 was asked (re_engage embeds Q1). Their answer -> store experience, ask Q2 with read-back.
      const patch: Partial<Qualification> = {};
      if (extracted.experienceLevel) patch.experienceLevel = extracted.experienceLevel;
      return decide('q2', q2Message(readback), patch, ['qualification_advanced']);
    }

    case 'q2': {
      // Q2 = what to improve -> Biggest Challenge. Ask Q3 (fixed).
      const patch: Partial<Qualification> = {};
      if (extracted.biggestChallenge) patch.biggestChallenge = extracted.biggestChallenge;
      return decide('q3', fill(FIXED_COPY.q3 ?? '', vars), patch, ['qualification_advanced']);
    }

    case 'q3': {
      // Q3 = why -> Desired Outcome. Ask Q4 (fixed, "deployed").
      const patch: Partial<Qualification> = {};
      if (extracted.desiredOutcome) patch.desiredOutcome = extracted.desiredOutcome;
      return decide('q4', fill(FIXED_COPY.q4 ?? '', vars), patch, ['qualification_advanced']);
    }

    case 'q4': {
      // Vocab swap: prospect questions "deployed" -> re-ask with "invested", never explain.
      if (intent === 'questions_vocab') {
        return decide('q4', q4SwapMessage(u.readback?.trim() || VOCAB_SWAP_READBACK), {
          deployedSwappedToInvested: true,
        }, []);
      }

      const patch: Partial<Qualification> = {};
      if (extracted.portfolioValue) patch.portfolioValue = extracted.portfolioValue;
      if (typeof extracted.holdsAssets === 'boolean') patch.holdsAssets = extracted.holdsAssets;

      const tier = capitalTier(extracted.portfolioValue);

      if (tier === 'low') {
        // Node 7c — soft close, do not pitch.
        return decide(
          'soft_close_low_capital',
          fill(FIXED_COPY.soft_close_low_capital ?? '', vars),
          { ...patch, status: 'Not Qualified', fit: 'weak' },
          ['lead_parked'],
          { parkUntilHours: 0 },
        );
      }

      if (tier === 'mid') {
        // Borderline capital -> pitch but flag a human for pre-call review.
        return decide(
          'pitch_call',
          fill(FIXED_COPY.pitch_call ?? '', vars),
          { ...patch, status: 'Needs Manual Review', fit: 'borderline' },
          ['qualification_advanced', 'hitl_requested'],
          { flagForHuman: true },
        );
      }

      // high capital -> pitch.
      return decide(
        'pitch_call',
        fill(FIXED_COPY.pitch_call ?? '', vars),
        { ...patch, status: 'Qualified', fit: 'strong' },
        ['qualification_advanced'],
      );
    }

    case 'pitch_call':
      if (intent === 'hesitant') {
        return decide('hesitant', fill(FIXED_COPY.hesitant ?? '', vars), {}, ['objection_handled']);
      }
      // agree -> collect the email before sending the booking link.
      return decide('ask_email', fill(FIXED_COPY.ask_email ?? '', vars), {}, []);

    case 'hesitant':
      if (intent === 'hesitant') {
        // Still hesitant after two exchanges -> parked.
        if (state.hesitantExchanges >= 1) return toPark();
        return decide('hesitant', fill(FIXED_COPY.hesitant ?? '', vars), {}, ['objection_handled']);
      }
      return decide('ask_email', fill(FIXED_COPY.ask_email ?? '', vars), {}, []);

    case 'ask_email': {
      // Email captured (minimum) -> send the booking link with the name pre-filled.
      // We never block the booking on a missing email; the link still goes out.
      const contactPatch =
        u.contact?.email || u.contact?.phone
          ? { email: u.contact?.email, phone: u.contact?.phone }
          : undefined;
      const bookingLink = bookingLinkWithName(vars.bookingLink, vars.firstName);
      const reply = fill(FIXED_COPY.send_link ?? '', { ...vars, bookingLink });
      return decide('send_link', reply, {}, ['booking_link_sent'], contactPatch ? { contactPatch } : {});
    }

    case 'send_link':
    case 'booking_reminder':
      // Booking confirmation arrives via the calendar webhook, not the DM. Wait quietly.
      return decide(state.node, undefined, {}, []);

    case 'parked':
    case 'soft_close_low_capital':
    case 'value_touch':
      // Lead re-engaged on their own -> re-enter the screen at Q1.
      return decide('q1', fill(FIXED_COPY.q1 ?? '', vars), {}, ['qualification_advanced']);

    case 'disqualified':
    case 'booked':
    case 'not_prospect':
      return decide(state.node, undefined, {}, []);
  }
}

/**
 * Handle a silence timeout. value_touch is framed as something Robin did (never "following up").
 * Max two value-touches, then parked. After the booking link, a single 72h reminder.
 */
export function onSilence(state: BrainState, vars: FlowVars): BrainDecision {
  // Never re-engage someone we flagged as a non-customer.
  if (state.node === 'not_prospect') return decide(state.node, undefined, {}, []);
  if (state.node === 'send_link') {
    return decide('booking_reminder', fill(FIXED_COPY.booking_reminder ?? '', vars), {}, []);
  }
  if (state.node === 'booking_reminder') {
    return toPark();
  }
  // Qualifying / welcome silence -> value touch (max 2), else park.
  if (state.valueTouchCount >= 2) return toPark();
  return decide('value_touch', fill(FIXED_COPY.value_touch ?? '', vars), {}, [], {
    parkUntilHours: 72,
  });
}
