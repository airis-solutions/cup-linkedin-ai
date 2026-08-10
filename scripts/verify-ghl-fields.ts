/**
 * Prüft, ob jede konfigurierte GHL-Custom-Field-ID wirklich beschreibbar ist.
 *
 *   npx tsx scripts/verify-ghl-fields.ts <contactId>
 *
 * Hintergrund: GHL quittiert Schreibvorgänge auf UNBEKANNTE Field-IDs mit HTTP 200 und
 * `succeeded: true` — und verwirft den Wert still. Ein Tippfehler in einer ID (etwa ein
 * kleines l statt großem I, genau das ist uns passiert) fällt dadurch nie auf: der Sync
 * läuft scheinbar sauber, die Felder bleiben aber leer.
 *
 * Dieses Skript schreibt pro Feld einen Testwert, liest zurück, und stellt danach den
 * ursprünglichen Zustand wieder her. Nach jeder Änderung an den IDs einmal laufen lassen.
 */
import 'dotenv/config';
import { createGhlFromEnv } from '../src/channel/ghl.js';
import { GHL } from '../src/config/ghl.js';

const contactId = process.argv[2];
if (!contactId) {
  console.error('Aufruf: npx tsx scripts/verify-ghl-fields.ts <contactId>');
  console.error('Einen Testkontakt nehmen — das Skript schreibt und stellt danach wieder her.');
  process.exit(1);
}

const ghl = createGhlFromEnv();
if (!ghl) throw new Error('GHL nicht konfiguriert (Token/Location fehlen).');

/** Testwerte, die zu keinem echten Wert passen, damit die Rückgabe eindeutig ist. */
const PROBE = 'AIRIS_PROBE';

const before = await ghl.getContact(contactId);
if (!before.ok || !before.data) throw new Error(`Kontakt nicht lesbar: ${before.error}`);
const original = new Map(before.data.customFields.map((f) => [f.id, f.value]));

const results: { name: string; id: string; ok: boolean }[] = [];

for (const [name, id] of Object.entries(GHL.fields)) {
  await ghl.updateContact(contactId, { customFields: [{ id, value: PROBE }] });
  const after = await ghl.getContact(contactId);
  const landed = (after.data?.customFields ?? []).some((f) => f.id === id && f.value === PROBE);
  results.push({ name, id, ok: landed });

  // sofort zurücksetzen, damit der Kontakt nie mit Testwerten stehenbleibt
  await ghl.updateContact(contactId, { customFields: [{ id, value: original.get(id) ?? '' }] });
}

console.log(`\nFeld-Prüfung an Kontakt ${contactId}\n`);
for (const r of results) {
  console.log(`  ${r.ok ? '✓' : '✗'} ${r.name.padEnd(20)} ${r.id}${r.ok ? '' : '   ← ID existiert nicht, Werte gehen verloren'}`);
}
const broken = results.filter((r) => !r.ok);
console.log(
  broken.length === 0
    ? '\nAlle Felder sind beschreibbar.\n'
    : `\n${broken.length} Feld(er) kaputt — korrekte IDs bei Fabi erfragen.\n`,
);
process.exit(broken.length === 0 ? 0 : 1);
