/**
 * HTTP surface for the LinkedIn AI.
 *
 * - POST /webhooks/unipile  — Unipile delivers an incoming LinkedIn DM here; the AI drafts a
 *                              reply that waits for human approval.
 * - POST /webhooks/unipile/relations — a cold lead accepted the connection request (Trigger A);
 *                              the AI drafts the warm opener (pending approval).
 * - POST /webhooks/ghl      — GHL fires when a prospect books a slot; we mark the lead booked
 *                              and stop follow-ups.
 * - GET  /pending           — list messages awaiting approval (the HITL queue).
 * - POST /approve           — approve a draft; sends it now if the send gate allows, else the
 *                              next cycle run does.
 * - POST /reject            — discard a draft.
 *
 * - GET  /review?t=…        — the page behind the Telegram link: one draft, the conversation,
 *                              send / edit / discard. Read-only, since Telegram fetches links
 *                              for previews.
 * - POST /review            — the reviewer's choice from that page.
 *
 * /review is authorised by the signed link itself (src/lib/review-link.ts), scoped to one
 * draft. The three approval routes need DASHBOARD_TOKEN: they expose prospects' conversations and can
 * send from Robin's account. They fail closed when no token is configured.
 * - GET  /health            — liveness.
 *
 * `route()` is pure ({method, path, body} -> {status, json}) so it's unit-testable; the
 * Node http server is a thin wrapper around it.
 */
import { createServer, type Server } from 'node:http';
import type { OrchestratorDeps } from './orchestrator.js';
import type { UnipileClient } from './channel/index.js';
import {
  approveMessage,
  dispatchApprovedForLead,
  handleGhlAppointmentWebhook,
  handleNewRelation,
  handleUnipileWebhook,
  rejectMessage,
  type GhlAppointmentWebhook,
  type UnipileInboundWebhook,
  type UnipileNewRelationWebhook,
} from './channel/index.js';
import { logger } from './lib/logger.js';
import { notify } from './lib/notify.js';
import { verifyReviewToken } from './lib/review-link.js';
import { reviewFormPage, reviewMessagePage } from './handlers/review-page.js';

export interface AppDeps extends OrchestratorDeps {
  unipile: UnipileClient | null;
  /** Optional shared secret; if set, /webhooks/unipile must present it. */
  webhookSecret?: string;
  /** Required for the approval routes. Unset = those routes are closed. */
  dashboardToken?: string;
  /**
   * Decides whether an approved message may go out right now: inside the sending window and
   * with a unit of today's budget reserved. Unset = never send on approve, leave it to the cycle.
   */
  sendGate?: () => Promise<boolean>;
}

const APPROVAL_ROUTES = new Set(['GET /pending', 'POST /approve', 'POST /reject']);

export interface RouteRequest {
  method: string;
  path: string;
  body: Record<string, unknown>;
  headers: Record<string, string | undefined>;
  query?: Record<string, string | undefined>;
}

export interface RouteResponse {
  status: number;
  json?: unknown;
  /** Set for pages meant for a browser; sent as text/html instead of the JSON. */
  html?: string;
}

export async function route(deps: AppDeps, req: RouteRequest): Promise<RouteResponse> {
  const { method, path } = req;

  if (method === 'GET' && path === '/health') {
    return { status: 200, json: { ok: true } };
  }

  if (method === 'POST' && path === '/webhooks/unipile') {
    if (deps.webhookSecret && req.headers['x-webhook-secret'] !== deps.webhookSecret) {
      return { status: 401, json: { error: 'bad secret' } };
    }
    const turn = await handleUnipileWebhook(deps, req.body as unknown as UnipileInboundWebhook);
    return { status: 200, json: { ok: true, leadId: turn?.leadId ?? null, node: turn?.node ?? null } };
  }

  if (method === 'POST' && path === '/webhooks/unipile/relations') {
    if (deps.webhookSecret && req.headers['x-webhook-secret'] !== deps.webhookSecret) {
      return { status: 401, json: { error: 'bad secret' } };
    }
    const turn = await handleNewRelation(deps, req.body as unknown as UnipileNewRelationWebhook);
    return { status: 200, json: { ok: true, leadId: turn?.leadId ?? null, node: turn?.node ?? null } };
  }

  if (method === 'POST' && path === '/webhooks/ghl') {
    if (deps.webhookSecret && req.headers['x-webhook-secret'] !== deps.webhookSecret) {
      return { status: 401, json: { error: 'bad secret' } };
    }
    const result = await handleGhlAppointmentWebhook(
      { repo: deps.repo, ghl: deps.ghl },
      req.body as unknown as GhlAppointmentWebhook,
    );
    return { status: 200, json: { ok: true, booking: result } };
  }

  if (path === '/review' && (method === 'GET' || method === 'POST')) {
    return review(deps, req);
  }

  if (APPROVAL_ROUTES.has(`${method} ${path}`)) {
    if (!deps.dashboardToken) return { status: 503, json: { error: 'approvals not configured (set DASHBOARD_TOKEN)' } };
    if (req.headers['x-dashboard-token'] !== deps.dashboardToken) return { status: 401, json: { error: 'unauthorized' } };
  }

  if (method === 'GET' && path === '/pending') {
    return { status: 200, json: await deps.repo.pendingApprovals() };
  }

  if (method === 'POST' && path === '/approve') {
    const messageId = String(req.body.messageId ?? '');
    const leadId = String(req.body.leadId ?? '');
    if (!messageId) return { status: 400, json: { error: 'messageId required' } };
    await approveMessage(deps.repo, messageId);
    // Approving at 23:00 must not send at 23:00: outside the window or without budget the
    // message stays approved and the next cycle run sends it.
    let dispatched = null;
    if (deps.unipile && leadId && deps.sendGate && (await deps.sendGate())) {
      dispatched = await dispatchApprovedForLead({ repo: deps.repo, unipile: deps.unipile }, leadId);
    }
    return { status: 200, json: { ok: true, dispatched } };
  }

  if (method === 'POST' && path === '/reject') {
    const messageId = String(req.body.messageId ?? '');
    if (!messageId) return { status: 400, json: { error: 'messageId required' } };
    await rejectMessage(deps.repo, messageId);
    return { status: 200, json: { ok: true } };
  }

  return { status: 404, json: { error: 'not found' } };
}

const html = (status: number, page: string): RouteResponse => ({ status, html: page });

async function review(deps: AppDeps, req: RouteRequest): Promise<RouteResponse> {
  if (!deps.dashboardToken) {
    return html(503, reviewMessagePage('Nicht eingerichtet', 'Freigaben sind nicht eingerichtet (DASHBOARD_TOKEN fehlt).'));
  }
  const token = String((req.method === 'GET' ? req.query?.t : req.body.t) ?? '');
  const messageId = verifyReviewToken(token, deps.dashboardToken, new Date());
  if (!messageId) {
    return html(403, reviewMessagePage('Link ungültig', 'Dieser Link ist ungültig oder abgelaufen. Den Entwurf findest du im Dashboard.'));
  }

  const draft = await deps.repo.getMessage(messageId);
  const lead = draft ? await deps.repo.getLead(draft.leadId) : null;
  if (!draft || !lead) return html(404, reviewMessagePage('Nicht gefunden', 'Diesen Entwurf gibt es nicht mehr.'));

  if (draft.status !== 'pending_hitl') {
    const was: Record<string, string> = {
      sent: 'ist schon gesendet',
      approved: 'ist schon freigegeben und geht im nächsten Lauf raus',
      skipped: 'wurde verworfen',
      failed: 'ist beim Senden gescheitert',
    };
    return html(409, reviewMessagePage('Schon erledigt', `Dieser Entwurf ${was[draft.status] ?? 'ist schon erledigt'}.`));
  }

  if (req.method === 'GET') {
    return html(200, reviewFormPage(token, lead, draft, await deps.repo.messagesForLead(lead.id)));
  }

  const action = String(req.body.action ?? '');
  if (action === 'reject') {
    await rejectMessage(deps.repo, draft.id);
    logger.info({ messageId: draft.id }, 'review.rejected');
    return html(200, reviewMessagePage('Verworfen', '🗑 Verworfen. Es geht nichts raus.'));
  }
  if (action !== 'approve') return html(400, reviewMessagePage('Unklar', 'Unbekannte Aktion.'));

  if (req.body.text !== undefined) {
    const text = String(req.body.text).replace(/\r\n/g, '\n').trim();
    if (!text) return html(400, reviewMessagePage('Leer', 'Die Nachricht ist leer. Zurück und Text eingeben oder verwerfen.'));
    if (text !== draft.body) await deps.repo.updateMessageBody(draft.id, text);
  }
  await approveMessage(deps.repo, draft.id);
  logger.info({ messageId: draft.id }, 'review.approved');

  // Same gate as /approve: inside the window and with budget, else the next cycle run sends.
  if (deps.unipile && deps.sendGate && (await deps.sendGate())) {
    const { sent } = await dispatchApprovedForLead({ repo: deps.repo, unipile: deps.unipile }, lead.id);
    if (sent > 0) return html(200, reviewMessagePage('Gesendet', '✅ Gesendet.'));
    void (deps.alert ?? notify)({
      kind: 'system',
      title: 'Freigegebene Nachricht ging nicht raus',
      detail: `${lead.fullName ?? lead.firstName ?? lead.id}: LinkedIn hat das Senden abgelehnt (Status jetzt "failed").`,
      leadId: lead.id,
    });
    return html(502, reviewMessagePage('Fehler', 'Freigegeben, aber LinkedIn hat das Senden abgelehnt. Ein Alarm geht an Telegram.'));
  }
  return html(200, reviewMessagePage('Freigegeben', '✅ Freigegeben. Geht im nächsten Lauf raus (außerhalb der Sendezeit oder Tageslimit erreicht).'));
}

/** JSON from the webhooks and API, url-encoded from the review page's form. */
function readBody(stream: NodeJS.ReadableStream, contentType = ''): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    let raw = '';
    stream.on('data', (c) => (raw += c));
    stream.on('end', () => {
      if (contentType.includes('application/x-www-form-urlencoded')) {
        resolve(Object.fromEntries(new URLSearchParams(raw)));
        return;
      }
      try {
        resolve(raw ? (JSON.parse(raw) as Record<string, unknown>) : {});
      } catch {
        resolve({});
      }
    });
    stream.on('error', () => resolve({}));
  });
}

export function startServer(deps: AppDeps, port: number): Server {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const body = req.method === 'POST' ? await readBody(req, req.headers['content-type']) : {};
    const result = await route(deps, {
      method: req.method ?? 'GET',
      path: url.pathname,
      body,
      headers: req.headers as Record<string, string | undefined>,
      query: Object.fromEntries(url.searchParams),
    });
    if (result.html !== undefined) {
      res.writeHead(result.status, { 'content-type': 'text/html; charset=utf-8' });
      res.end(result.html);
      return;
    }
    res.writeHead(result.status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(result.json));
  });
  server.listen(port, () => logger.info({ port }, 'server.listening'));
  return server;
}
