/**
 * HTTP surface for the LinkedIn AI.
 *
 * - POST /webhooks/unipile  — Unipile delivers an incoming LinkedIn DM here; the AI drafts a
 *                              reply that waits for human approval.
 * - GET  /pending           — list messages awaiting approval (the HITL queue).
 * - POST /approve           — approve a draft and send it via Unipile.
 * - POST /reject            — discard a draft.
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
  handleUnipileWebhook,
  rejectMessage,
  type UnipileInboundWebhook,
} from './channel/index.js';
import { logger } from './lib/logger.js';

export interface AppDeps extends OrchestratorDeps {
  unipile: UnipileClient | null;
  /** Optional shared secret; if set, /webhooks/unipile must present it. */
  webhookSecret?: string;
}

export interface RouteRequest {
  method: string;
  path: string;
  body: Record<string, unknown>;
  headers: Record<string, string | undefined>;
}

export interface RouteResponse {
  status: number;
  json: unknown;
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

  if (method === 'GET' && path === '/pending') {
    return { status: 200, json: await deps.repo.pendingApprovals() };
  }

  if (method === 'POST' && path === '/approve') {
    const messageId = String(req.body.messageId ?? '');
    const leadId = String(req.body.leadId ?? '');
    if (!messageId) return { status: 400, json: { error: 'messageId required' } };
    await approveMessage(deps.repo, messageId);
    let dispatched = null;
    if (deps.unipile && leadId) {
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

function readJson(stream: NodeJS.ReadableStream): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    let raw = '';
    stream.on('data', (c) => (raw += c));
    stream.on('end', () => {
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
    const body = req.method === 'POST' ? await readJson(req) : {};
    const result = await route(deps, {
      method: req.method ?? 'GET',
      path: url.pathname,
      body,
      headers: req.headers as Record<string, string | undefined>,
    });
    res.writeHead(result.status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(result.json));
  });
  server.listen(port, () => logger.info({ port }, 'server.listening'));
  return server;
}
