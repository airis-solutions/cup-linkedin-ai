/**
 * Unipile client — the bridge to Robin's LinkedIn account.
 *
 * Unipile hosts the LinkedIn session; we talk to its REST API:
 *   base URL  = https://{DSN}/api/v1
 *   auth      = X-API-KEY header
 *   send reply  -> POST /chats/{chat_id}/messages   (text, multipart)
 *   first DM    -> POST /chats                       (account_id, attendees_ids, text)
 *   resolve     -> GET  /users/{identifier}          (public identifier -> provider_id)
 *   invite      -> POST /users/invite                (account_id, provider_id) [Trigger A]
 *   search      -> POST /linkedin/search             (people search -> list building)
 *   filter ids  -> GET  /linkedin/search/parameters  ("Switzerland" -> 106693272)
 *
 * `fetchImpl` is injectable so the request building is unit-testable without network.
 */

type FetchLike = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: unknown },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown>; text(): Promise<string> }>;

export interface UnipileConfig {
  /** Host (and optional port) from the Unipile dashboard, e.g. "api8.unipile.com:13845". */
  dsn: string;
  apiKey: string;
  /** Robin's connected LinkedIn account id (from Unipile). */
  accountId: string;
  fetchImpl?: FetchLike;
}

export interface SendResult {
  ok: boolean;
  id?: string;
  error?: string;
}

export interface ResolveResult {
  ok: boolean;
  /** The provider id needed to invite or message this person. */
  providerId?: string;
  /** Display name from LinkedIn, if returned. */
  name?: string;
  /** Free-text location, e.g. "Stuttgart, Baden-Württemberg, Germany" — used to pick the language. */
  location?: string;
  error?: string;
}

/**
 * Filters for a LinkedIn people search. `location` and `industry` are LinkedIn's own numeric
 * ids, not free text — resolve them with `searchParameters` first.
 */
export interface PeopleSearchFilters {
  keywords?: string;
  location?: string[];
  industry?: string[];
  /**
   * Network degrees to include. Default is 2nd degree only: 1st are already connected (nothing
   * to invite) and 3rd-degree invites often need an email address, so they mostly fail.
   */
  networkDistance?: number[];
}

/** One person from a search result. `providerId` is what invites and DMs are addressed to. */
export interface SearchProfile {
  providerId: string;
  name?: string;
  profileUrl?: string;
  publicIdentifier?: string;
  headline?: string;
  location?: string;
  /** LinkedIn's own label, e.g. "DISTANCE_2". */
  networkDistance?: string;
}

export interface SearchPageResult {
  ok: boolean;
  items: SearchProfile[];
  /** Pass back into the next call to page on. Absent once the results run out. */
  cursor?: string;
  error?: string;
}

/** One resolved filter value, e.g. { id: "106693272", title: "Switzerland" }. */
export interface SearchParameter {
  id: string;
  title: string;
}

export class UnipileClient {
  constructor(private readonly cfg: UnipileConfig) {}

  private get fetch(): FetchLike {
    return this.cfg.fetchImpl ?? (globalThis.fetch as unknown as FetchLike);
  }

  private url(path: string): string {
    return `https://${this.cfg.dsn}/api/v1${path}`;
  }

  private headers(): Record<string, string> {
    return { 'X-API-KEY': this.cfg.apiKey, accept: 'application/json' };
  }

  /** Reply inside an existing LinkedIn conversation. */
  async sendInChat(chatId: string, text: string): Promise<SendResult> {
    const form = new FormData();
    form.append('text', text);
    try {
      const res = await this.fetch(this.url(`/chats/${chatId}/messages`), {
        method: 'POST',
        headers: this.headers(),
        body: form,
      });
      if (!res.ok) return { ok: false, error: `Unipile ${res.status}: ${(await res.text()).slice(0, 200)}` };
      const d = (await res.json()) as { message_id?: string; id?: string };
      return { ok: true, id: d.message_id ?? d.id };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  /** Start a new conversation (cold opener) with a LinkedIn user by their provider id. */
  async startChat(attendeeId: string, text: string): Promise<SendResult & { chatId?: string }> {
    const form = new FormData();
    form.append('account_id', this.cfg.accountId);
    form.append('attendees_ids', attendeeId);
    form.append('text', text);
    form.append('linkedin[api]', 'classic');
    try {
      const res = await this.fetch(this.url('/chats'), {
        method: 'POST',
        headers: this.headers(),
        body: form,
      });
      if (!res.ok) return { ok: false, error: `Unipile ${res.status}: ${(await res.text()).slice(0, 200)}` };
      const d = (await res.json()) as { chat_id?: string; id?: string };
      const chatId = d.chat_id ?? d.id;
      return { ok: true, id: chatId, chatId };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  /**
   * Resolve a LinkedIn profile to its provider id (needed to invite / message).
   * `identifier` is the public identifier from the profile URL (e.g. "felix-schreppel").
   */
  async resolveProfile(identifier: string): Promise<ResolveResult> {
    const qs = `?account_id=${encodeURIComponent(this.cfg.accountId)}`;
    try {
      const res = await this.fetch(this.url(`/users/${encodeURIComponent(identifier)}${qs}`), {
        method: 'GET',
        headers: this.headers(),
      });
      if (!res.ok) return { ok: false, error: `Unipile ${res.status}: ${(await res.text()).slice(0, 200)}` };
      const d = (await res.json()) as {
        provider_id?: string;
        id?: string;
        name?: string;
        first_name?: string;
        last_name?: string;
        location?: string;
      };
      const providerId = d.provider_id ?? d.id;
      const name = d.name ?? ([d.first_name, d.last_name].filter(Boolean).join(' ') || undefined);
      if (!providerId) return { ok: false, error: 'no provider_id in response' };
      return { ok: true, providerId, name, location: d.location || undefined };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  /**
   * Send a LinkedIn connection request (Trigger A). No note = "blank connect" (highest
   * accept rate, no compliance surface). The AI's opener fires only once they accept.
   */
  async sendInvitation(providerId: string): Promise<SendResult> {
    try {
      const res = await this.fetch(this.url('/users/invite'), {
        method: 'POST',
        headers: { ...this.headers(), 'content-type': 'application/json' },
        body: JSON.stringify({ account_id: this.cfg.accountId, provider_id: providerId }),
      });
      if (!res.ok) return { ok: false, error: `Unipile ${res.status}: ${(await res.text()).slice(0, 200)}` };
      const d = (await res.json()) as { invitation_id?: string; id?: string };
      return { ok: true, id: d.invitation_id ?? d.id };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  /**
   * Run a LinkedIn people search through Robin's session — this is how cold lists get built.
   *
   * Deliberately the `classic` search, not `sales_navigator`: the connected account has no
   * Sales Navigator subscription, and Unipile answers that api with 403 feature_not_subscribed.
   * Classic has fewer filters but needs no extra subscription and no second tool on the account.
   *
   * Results already carry the provider id, so a list built this way skips `resolveProfile`.
   */
  async searchPeople(
    filters: PeopleSearchFilters,
    opts: { cursor?: string; limit?: number } = {},
  ): Promise<SearchPageResult> {
    const qs = new URLSearchParams({ account_id: this.cfg.accountId });
    if (opts.limit) qs.set('limit', String(opts.limit));
    if (opts.cursor) qs.set('cursor', opts.cursor);

    const body: Record<string, unknown> = { api: 'classic', category: 'people' };
    if (filters.keywords) body.keywords = filters.keywords;
    if (filters.location?.length) body.location = filters.location;
    if (filters.industry?.length) body.industry = filters.industry;
    body.network_distance = filters.networkDistance?.length ? filters.networkDistance : [2];

    try {
      const res = await this.fetch(this.url(`/linkedin/search?${qs.toString()}`), {
        method: 'POST',
        headers: { ...this.headers(), 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        return { ok: false, items: [], error: `Unipile ${res.status}: ${(await res.text()).slice(0, 200)}` };
      }
      const d = (await res.json()) as { items?: unknown[]; cursor?: string };
      return { ok: true, items: (d.items ?? []).map(toSearchProfile).filter(isProfile), cursor: d.cursor || undefined };
    } catch (e) {
      return { ok: false, items: [], error: e instanceof Error ? e.message : String(e) };
    }
  }

  /**
   * Turn a filter name into LinkedIn's id for it ("Switzerland" -> "106693272"). Searches take
   * ids only, so every location/industry filter goes through here first.
   */
  async searchParameters(
    type: 'LOCATION' | 'INDUSTRY',
    keywords: string,
    limit = 5,
  ): Promise<{ ok: boolean; items: SearchParameter[]; error?: string }> {
    const qs = new URLSearchParams({
      account_id: this.cfg.accountId,
      type,
      keywords,
      limit: String(limit),
    });
    try {
      const res = await this.fetch(this.url(`/linkedin/search/parameters?${qs.toString()}`), {
        method: 'GET',
        headers: this.headers(),
      });
      if (!res.ok) {
        return { ok: false, items: [], error: `Unipile ${res.status}: ${(await res.text()).slice(0, 200)}` };
      }
      const d = (await res.json()) as { items?: { id?: string; title?: string }[] };
      const items = (d.items ?? [])
        .filter((i): i is { id: string; title: string } => Boolean(i.id && i.title))
        .map((i) => ({ id: String(i.id), title: i.title }));
      return { ok: true, items };
    } catch (e) {
      return { ok: false, items: [], error: e instanceof Error ? e.message : String(e) };
    }
  }
}

/** Map one raw search item to our shape; items without a provider id are unusable. */
function toSearchProfile(raw: unknown): SearchProfile | undefined {
  const r = raw as {
    id?: string;
    name?: string;
    profile_url?: string;
    public_profile_url?: string;
    public_identifier?: string;
    headline?: string;
    location?: string;
    network_distance?: string;
  };
  if (!r?.id) return undefined;
  return {
    providerId: r.id,
    name: r.name?.trim() || undefined,
    profileUrl: r.public_profile_url || r.profile_url || undefined,
    publicIdentifier: r.public_identifier || undefined,
    headline: r.headline?.trim() || undefined,
    location: r.location?.trim() || undefined,
    networkDistance: r.network_distance || undefined,
  };
}

function isProfile(p: SearchProfile | undefined): p is SearchProfile {
  return p !== undefined;
}

/** Shape of an incoming-message webhook from Unipile (the fields we use). */
export interface UnipileInboundWebhook {
  account_id: string;
  chat_id: string;
  /** Unipile's id for this message — used to dedupe redelivered webhooks. */
  message_id?: string;
  /** The connected account owner. Unipile delivers the owner's OWN sent messages too, so
   * we compare this against `sender` to drop them (otherwise the AI replies to itself). */
  account_info?: { user_id?: string };
  /** 1/true when the linked account itself is the sender of this message. */
  is_sender?: boolean | number | string;
  /** Sender's LinkedIn provider id + display name. */
  sender?: { attendee_provider_id?: string; attendee_id?: string; attendee_name?: string };
  message?: string;
  text?: string;
}

/** Normalise a webhook payload to the bits the orchestrator needs. */
export function parseInbound(payload: UnipileInboundWebhook): {
  accountId: string;
  chatId: string;
  senderId?: string;
  /** Sender's display name from LinkedIn, e.g. "Felix Schreppel". */
  senderName?: string;
  text: string;
  /** Unipile message id, for deduping redelivered webhooks. */
  messageId?: string;
  /** True when Robin's own account sent this message — Unipile echoes those back. */
  fromSelf: boolean;
} {
  const senderId = payload.sender?.attendee_provider_id ?? payload.sender?.attendee_id;
  const ownerId = payload.account_info?.user_id;
  const isSenderFlag = payload.is_sender === true || payload.is_sender === 1 || payload.is_sender === '1';
  const fromSelf = isSenderFlag || (ownerId != null && senderId != null && ownerId === senderId);
  return {
    accountId: payload.account_id,
    chatId: payload.chat_id,
    senderId,
    senderName: payload.sender?.attendee_name?.trim() || undefined,
    text: payload.message ?? payload.text ?? '',
    messageId: payload.message_id || undefined,
    fromSelf,
  };
}

/** First name from a LinkedIn display name ("Felix Schreppel" -> "Felix"). */
export function firstNameOf(name: string | undefined): string | undefined {
  return name?.trim().split(/\s+/)[0] || undefined;
}

/**
 * Extract the public identifier from a LinkedIn profile URL for `resolveProfile`.
 * "https://www.linkedin.com/in/felix-schreppel/" -> "felix-schreppel".
 * Returns undefined for a Sales Navigator /sales/lead/ URL (no public identifier in it).
 */
export function publicIdentifierFromUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  const slug = url.match(/\/in\/([^/?#]+)/i)?.[1];
  return slug ? decodeURIComponent(slug) : undefined;
}

/** Shape of a Unipile USERS webhook `new_relation` event (the fields we use). */
export interface UnipileNewRelationWebhook {
  /** Event discriminator; the USERS webhook also emits other event types. */
  event?: string;
  account_id?: string;
  /** The newly connected user's provider id + name (field names per Unipile USERS webhook). */
  user_provider_id?: string;
  user_full_name?: string;
  user_profile_url?: string;
}

/** Normalise a `new_relation` webhook to the bits the handler needs. */
export function parseNewRelation(payload: UnipileNewRelationWebhook): {
  providerId?: string;
  name?: string;
  profileUrl?: string;
} {
  return {
    providerId: payload.user_provider_id || undefined,
    name: payload.user_full_name?.trim() || undefined,
    profileUrl: payload.user_profile_url || undefined,
  };
}
