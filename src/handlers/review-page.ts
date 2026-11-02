/**
 * The page behind the "Prüfen & senden" link in Telegram: one draft, the conversation it
 * answers, and three choices. Plain server-rendered HTML with a form — nothing to install,
 * works in Telegram's in-app browser, and the link token rides along in a hidden field.
 */
import type { LeadRecord, MessageRecord } from '../store/repository.js';

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(title)}</title>
<style>
  :root { color-scheme: light dark; --fg:#0a0a0a; --muted:#6b7280; --bg:#fff; --card:#f4f5f7; --accent:#0ea5e9; --line:#e5e7eb; }
  @media (prefers-color-scheme: dark) { :root { --fg:#f3f4f6; --muted:#9ca3af; --bg:#0a0a0a; --card:#17181b; --line:#27272a; } }
  * { box-sizing: border-box; }
  body { margin:0; padding:20px 16px 40px; font:16px/1.5 Inter, system-ui, -apple-system, sans-serif; color:var(--fg); background:var(--bg); }
  main { max-width:560px; margin:0 auto; }
  h1 { font-size:20px; margin:0 0 4px; }
  .meta { color:var(--muted); font-size:14px; margin:0 0 20px; }
  .meta a { color:var(--accent); }
  .thread { display:flex; flex-direction:column; gap:8px; margin-bottom:20px; }
  .msg { padding:10px 12px; border-radius:12px; max-width:88%; white-space:pre-wrap; font-size:15px; }
  .in { background:var(--card); align-self:flex-start; }
  .out { background:var(--accent); color:#fff; align-self:flex-end; }
  .warn { background:#fef3c7; color:#92400e; padding:10px 12px; border-radius:10px; font-size:14px; margin-bottom:16px; }
  label { font-weight:600; display:block; margin-bottom:6px; }
  textarea { width:100%; min-height:180px; padding:12px; font:inherit; color:var(--fg); background:var(--card); border:1px solid var(--line); border-radius:12px; resize:vertical; }
  .actions { display:flex; gap:10px; margin-top:14px; }
  button { flex:1; padding:14px; font:600 16px/1 inherit; border-radius:12px; border:0; cursor:pointer; }
  .send { background:var(--fg); color:var(--bg); }
  .drop { background:transparent; color:var(--muted); border:1px solid var(--line); }
  .done { font-size:18px; margin-top:40px; text-align:center; }
</style></head>
<body><main>${body}</main></body></html>`;
}

export function reviewMessagePage(title: string, text: string): string {
  return page(title, `<p class="done">${esc(text)}</p>`);
}

export function reviewFormPage(
  token: string,
  lead: LeadRecord,
  draft: MessageRecord,
  thread: MessageRecord[],
): string {
  const name = lead.fullName ?? lead.firstName ?? 'Unbekannt';
  const shown = thread
    .filter((m) => m.id !== draft.id && (m.direction === 'inbound' || m.status === 'sent'))
    .slice(-6);
  const newerInbound = thread.some((m) => m.direction === 'inbound' && m.createdAt > draft.createdAt);

  const bubbles = shown.length
    ? shown.map((m) => `<div class="msg ${m.direction === 'inbound' ? 'in' : 'out'}">${esc(m.body)}</div>`).join('')
    : `<div class="meta">${lead.source === 'cold_outbound' ? 'Hat die Vernetzungsanfrage angenommen, noch kein Gespräch.' : 'Noch kein Gespräch.'}</div>`;

  const warnings = [
    newerInbound ? `${esc(lead.firstName ?? 'Der Lead')} hat nach diesem Entwurf noch einmal geschrieben. Lieber verwerfen, die neue Antwort kommt separat.` : '',
    draft.guardFlagged ? 'Vom Sicherheitscheck markiert (z. B. Rendite-, Preis- oder Beratungsaussage). Bitte genau lesen.' : '',
  ]
    .filter(Boolean)
    .map((w) => `<div class="warn">${w}</div>`)
    .join('');

  const profile = lead.linkedinUrl?.startsWith('http')
    ? ` · <a href="${esc(lead.linkedinUrl)}" target="_blank" rel="noopener">LinkedIn-Profil</a>`
    : '';

  return page(
    `Freigabe: ${name}`,
    `<h1>${esc(name)}</h1>
<p class="meta">Schritt: ${esc(draft.node ?? '?')}${profile}</p>
<div class="thread">${bubbles}</div>
${warnings}
<form method="post" action="/api/review">
  <input type="hidden" name="t" value="${esc(token)}">
  <label for="text">Nachricht (kannst du ändern)</label>
  <textarea id="text" name="text">${esc(draft.body)}</textarea>
  <div class="actions">
    <button class="drop" name="action" value="reject">Verwerfen</button>
    <button class="send" name="action" value="approve">Senden</button>
  </div>
</form>`,
  );
}
