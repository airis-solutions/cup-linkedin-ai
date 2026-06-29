/**
 * GoHighLevel (LeadConnector) API client — pushes qualified leads into CGP's CRM and
 * books strategy calls against Robin's calendar.
 *
 *   base   = https://services.leadconnectorhq.com
 *   auth   = Authorization: Bearer <private integration token>, Version: 2021-07-28
 *
 * Structural IDs (pipeline, stages, custom fields, calendar) live in config/ghl.ts.
 * `fetchImpl` is injectable so request building is unit-testable without network.
 */
import { GHL } from '../config/ghl.js';
import type { GhlCustomField } from '../config/ghl.js';
import { loadEnv } from '../config/env.js';

const BASE = 'https://services.leadconnectorhq.com';
const VERSION = '2021-07-28';

type FetchLike = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown>; text(): Promise<string> }>;

export interface GhlConfig {
  token: string;
  locationId: string;
  fetchImpl?: FetchLike;
}

export interface GhlResult<T = undefined> {
  ok: boolean;
  data?: T;
  error?: string;
}

export interface UpsertContactInput {
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
  phone?: string;
  source?: string;
  tags?: string[];
  customFields?: GhlCustomField[];
}

/** A free slot as an ISO timestamp with offset, e.g. "2026-07-01T09:00:00+02:00". */
export type FreeSlot = string;

export class GhlClient {
  constructor(private readonly cfg: GhlConfig) {}

  private get fetch(): FetchLike {
    return this.cfg.fetchImpl ?? (globalThis.fetch as unknown as FetchLike);
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.cfg.token}`,
      Version: VERSION,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<GhlResult<T>> {
    try {
      const res = await this.fetch(`${BASE}${path}`, {
        method,
        headers: this.headers(),
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (!res.ok) {
        return { ok: false, error: `GHL ${res.status}: ${(await res.text()).slice(0, 300)}` };
      }
      return { ok: true, data: (await res.json()) as T };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  /** Create or update a contact (matched by email/phone within the location). */
  async upsertContact(input: UpsertContactInput): Promise<GhlResult<{ id: string; isNew: boolean }>> {
    const res = await this.request<{ contact?: { id?: string }; new?: boolean }>('POST', '/contacts/upsert', {
      locationId: this.cfg.locationId,
      ...input,
    });
    if (!res.ok) return { ok: false, error: res.error };
    const id = res.data?.contact?.id;
    if (!id) return { ok: false, error: 'GHL upsertContact: no contact id in response' };
    return { ok: true, data: { id, isNew: res.data?.new ?? false } };
  }

  async deleteContact(contactId: string): Promise<GhlResult> {
    return this.request('DELETE', `/contacts/${contactId}`);
  }

  /** Create an opportunity in the Leads pipeline at the given stage. */
  async createOpportunity(input: {
    name: string;
    pipelineStageId: string;
    contactId: string;
    status?: string;
  }): Promise<GhlResult<{ id: string }>> {
    const res = await this.request<{ opportunity?: { id?: string }; id?: string }>('POST', '/opportunities/', {
      pipelineId: GHL.pipelineId,
      locationId: this.cfg.locationId,
      name: input.name,
      pipelineStageId: input.pipelineStageId,
      status: input.status ?? 'open',
      contactId: input.contactId,
    });
    if (!res.ok) return { ok: false, error: res.error };
    const id = res.data?.opportunity?.id ?? res.data?.id;
    if (!id) return { ok: false, error: 'GHL createOpportunity: no opportunity id in response' };
    return { ok: true, data: { id } };
  }

  async updateOpportunityStage(opportunityId: string, pipelineStageId: string): Promise<GhlResult> {
    return this.request('PUT', `/opportunities/${opportunityId}`, {
      pipelineId: GHL.pipelineId,
      pipelineStageId,
    });
  }

  async deleteOpportunity(opportunityId: string): Promise<GhlResult> {
    return this.request('DELETE', `/opportunities/${opportunityId}`);
  }

  /** Available 45-min slots between two instants, grouped by day, in the given IANA timezone. */
  async getFreeSlots(startMs: number, endMs: number, timezone: string): Promise<GhlResult<FreeSlot[]>> {
    const qs = `startDate=${startMs}&endDate=${endMs}&timezone=${encodeURIComponent(timezone)}`;
    const res = await this.request<Record<string, unknown>>(
      'GET',
      `/calendars/${GHL.bookingCalendarId}/free-slots?${qs}`,
    );
    if (!res.ok) return { ok: false, error: res.error };
    // Response shape: { "YYYY-MM-DD": { slots: [iso,...] }, traceId }
    const slots: FreeSlot[] = [];
    for (const [key, val] of Object.entries(res.data ?? {})) {
      if (key === 'traceId') continue;
      const day = val as { slots?: string[] };
      if (Array.isArray(day.slots)) slots.push(...day.slots);
    }
    return { ok: true, data: slots };
  }

  /** Book the strategy call. startTime is an ISO timestamp with offset (a slot from getFreeSlots). */
  async bookAppointment(input: {
    contactId: string;
    startTime: FreeSlot;
    timezone: string;
    title?: string;
  }): Promise<GhlResult<{ id: string }>> {
    const res = await this.request<{ id?: string; appointment?: { id?: string } }>(
      'POST',
      '/calendars/events/appointments',
      {
        calendarId: GHL.bookingCalendarId,
        locationId: this.cfg.locationId,
        contactId: input.contactId,
        startTime: input.startTime,
        title: input.title ?? GHL.appointmentTitle,
        meetingLocationType: 'default',
        ignoreDateRange: false,
        toNotify: true,
      },
    );
    if (!res.ok) return { ok: false, error: res.error };
    const id = res.data?.id ?? res.data?.appointment?.id;
    if (!id) return { ok: false, error: 'GHL bookAppointment: no appointment id in response' };
    return { ok: true, data: { id } };
  }
}

/** Build a GhlClient from env, or null when GHL isn't configured (token + location id). */
export function createGhlFromEnv(): GhlClient | null {
  const env = loadEnv();
  if (!env.GHL_PRIVATE_INTEGRATION_TOKEN || !env.GHL_LOCATION_ID) return null;
  return new GhlClient({
    token: env.GHL_PRIVATE_INTEGRATION_TOKEN,
    locationId: env.GHL_LOCATION_ID,
  });
}
