import { readFileSync, writeFileSync } from 'node:fs';
import { mdToPdf } from 'md-to-pdf';

const stripSize = (svg) =>
  svg.replace(/(<svg[^>]*?)\s+width="[^"]*"/, '$1').replace(/(<svg[^>]*?)\s+height="[^"]*"/, '$1');
const logoDark = stripSize(readFileSync(new URL('../_assets/airis-logo-dark.svg', import.meta.url), 'utf8'));
const logoLight = stripSize(readFileSync(new URL('../_assets/airis-logo-light.svg', import.meta.url), 'utf8'));
const logoCgp = stripSize(readFileSync(new URL('../_assets/cgp-logo-dark.svg', import.meta.url), 'utf8'));

const css = `
  @page { size: A4; margin: 16mm 16mm 17mm; }
  @page :first { margin: 0; }
  * { box-sizing: border-box; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: -apple-system, "Helvetica Neue", Arial, sans-serif; color: #232a30; font-size: 10.3pt; line-height: 1.5; margin: 0; orphans: 3; widows: 3; }

  /* ---------- Cover (centered hero) ---------- */
  .cover { width: 210mm; height: 297mm; background: #0A0A0A; color: #F5F2ED; position: relative; page-break-after: always; overflow: hidden; }
  .cover::before { content: ""; position: absolute; right: -50mm; top: -50mm; width: 140mm; height: 140mm; border-radius: 50%; background: radial-gradient(circle, rgba(14,165,233,0.18), rgba(14,165,233,0) 70%); }
  .cover::after { content: ""; position: absolute; left: -55mm; bottom: -55mm; width: 150mm; height: 150mm; border-radius: 50%; background: radial-gradient(circle, rgba(224,146,47,0.10), rgba(224,146,47,0) 70%); }
  .cover-inner { position: relative; z-index: 2; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 28mm 24mm; }
  .cover-kicker { text-transform: uppercase; letter-spacing: 0.32em; font-size: 9.5pt; color: #5ec8f0; font-weight: 700; margin-bottom: 15mm; }
  .lockup { display: flex; align-items: center; justify-content: center; gap: 18mm; margin-bottom: 14mm; }
  .lockup .logo { display: flex; align-items: center; }
  .lockup .logo svg { height: 17mm; width: auto; display: block; }
  .lockup .lx { font-size: 26pt; font-weight: 200; color: #6f8ba0; line-height: 1; display: flex; align-items: center; height: 17mm; }
  .cover-rule { width: 54mm; height: 3px; margin: 0 0 11mm; background: linear-gradient(90deg, #12c2e9, #378cff); border-radius: 2px; }
  .cover-title { font-size: 38pt; line-height: 1.06; font-weight: 800; letter-spacing: -0.015em; margin: 0 0 7mm; }
  .cover-sub { font-size: 12.5pt; color: #aebcc5; max-width: 140mm; line-height: 1.45; margin: 0; }
  .cover-foot { position: absolute; left: 26mm; right: 26mm; bottom: 20mm; display: flex; justify-content: space-between; font-size: 8.5pt; color: #7c8c95; letter-spacing: 0.05em; text-transform: uppercase; border-top: 1px solid rgba(255,255,255,.13); padding-top: 5mm; z-index: 2; }

  /* ---------- Table of contents ---------- */
  .toc { page-break-after: always; padding-top: 4mm; }
  .toc-kicker { text-transform: uppercase; letter-spacing: 0.24em; font-size: 9pt; color: #0a7bb0; font-weight: 700; }
  .toc-head { font-size: 26pt; font-weight: 800; color: #0b1f33; margin: 1mm 0 8mm; letter-spacing: -0.01em; }
  .toc-list { list-style: none; padding: 0; margin: 0; }
  .toc-list li { display: flex; align-items: baseline; gap: 5mm; padding: 2.6mm 0; border-bottom: 1px solid #eef2f6; }
  .toc-num { flex: 0 0 11mm; font-weight: 800; font-size: 11pt; color: #0ea5e9; font-variant-numeric: tabular-nums; }
  .toc-t { font-size: 11pt; color: #2a333b; }

  /* ---------- Content ---------- */
  h2 { font-size: 14.5pt; color: #0b1f33; margin: 8mm 0 3mm; padding: 0 0 2mm 5mm; border-left: 4px solid #0ea5e9; line-height: 1.15; break-after: avoid; border-bottom: 1px solid #e7edf2; }
  h3 { font-size: 11.5pt; color: #0a7bb0; margin: 5mm 0 1.5mm; break-after: avoid; }
  p { margin: 1.8mm 0; orphans: 3; widows: 3; }
  strong { color: #0b1f33; }
  a { color: #0a7bb0; text-decoration: none; }
  hr { border: none; border-top: 1px solid #e7edf2; margin: 5mm 0; }

  ul, ol { padding-left: 6mm; margin: 1.8mm 0; }
  li { margin: 1mm 0; break-inside: avoid; }

  table { width: 100%; border-collapse: collapse; margin: 3mm 0; font-size: 9.1pt; }
  thead { display: table-header-group; }
  th { background: #0b1f33; color: #F5F2ED; text-align: left; padding: 2.2mm 3mm; font-weight: 600; }
  td { padding: 2.2mm 3mm; border-bottom: 1px solid #e6ebf0; vertical-align: top; }
  tr { break-inside: avoid; }
  tr:nth-child(even) td { background: #f6f9fb; }

  blockquote { background: #eff8fc; border-left: 4px solid #0ea5e9; margin: 4mm 0; padding: 3mm 6mm; border-radius: 0 5px 5px 0; break-inside: avoid; color: #2a3138; }
  blockquote h3 { margin: 0 0 1.5mm; color: #0b1f33; font-size: 11pt; }
  blockquote p:first-child { margin-top: 0; }
  blockquote p:last-child { margin-bottom: 0; }

  code { background: #eef2f6; padding: 0.3mm 1.4mm; border-radius: 3px; font-size: 8.7pt; font-family: "SF Mono", Menlo, monospace; color: #0b3a5b; }
  pre { background: #0b1f33; color: #cfe8f5; padding: 5mm; border-radius: 6px; font-size: 7.8pt; line-height: 1.3; break-inside: avoid; overflow: hidden; }
  pre code { background: none; color: inherit; padding: 0; font-size: 7.8pt; }

  /* ---------- Closing ---------- */
  .closing { margin-top: 10mm; padding-top: 6mm; border-top: 2px solid #0b1f33; display: flex; align-items: center; gap: 7mm; break-inside: avoid; }
  .closing .logo { width: 38mm; }
  .closing .logo svg { width: 100%; height: auto; display: block; }
  .closing .ctxt { font-size: 9pt; color: #5b6770; line-height: 1.4; }
`;

const editions = [
  {
    src: '../linkedin-content-plan.de.md',
    out: '../CGP-LinkedIn-Content-Plan-DE.pdf',
    kicker: 'Strategie-Playbook',
    title: 'LinkedIn Wachstums-<br/>&amp; Content-Motor',
    sub: 'Organische Reichweite, Community und ein skalierbarer Lead-Motor &ndash; das komplette Playbook.',
    foot: 'Erstellt von Airis Solutions f&uuml;r CryptoGameplan',
    docTitle: 'CGP LinkedIn Wachstums- & Content-Motor',
    tocHead: 'Inhalt',
    toc: [
      ['0', 'Die strategische Wette'],
      ['1', 'Wie LinkedIn-Reichweite wirklich funktioniert'],
      ['2', 'Das Profil = die Conversion-Seite'],
      ['3', 'Das Content-System &ndash; eine t&auml;gliche &bdquo;Show&ldquo;'],
      ['4', 'Die Repurposing-Engine'],
      ['5', 'Sales Navigator &ndash; Targeting + Outbound'],
      ['5b', 'Kaltstart + Netzwerk-Wachstum'],
      ['6', 'Die Community- + Engagement-Engine'],
      ['7', 'Der Funnel: jede Aktion l&auml;uft in die KI'],
      ['8', 'Kennzahlen & der Optimierungs-Loop'],
      ['9', 'Compliance &ndash; die harten Leitplanken'],
      ['10', 'Drei Beispiel-Posts'],
      ['11', 'Der 90-Tage-Ramp'],
    ],
  },
  {
    src: '../linkedin-content-plan.en.md',
    out: '../CGP-LinkedIn-Content-Plan-EN.pdf',
    kicker: 'Strategy Playbook',
    title: 'LinkedIn Growth<br/>&amp; Content Engine',
    sub: 'Organic reach, community and a scalable lead engine &ndash; the full playbook.',
    foot: 'Prepared by Airis Solutions for CryptoGameplan',
    docTitle: 'CGP LinkedIn Growth & Content Engine',
    tocHead: 'Contents',
    toc: [
      ['0', 'The strategic bet'],
      ['1', 'How LinkedIn reach actually works'],
      ['2', 'The profile = the conversion page'],
      ['3', 'The content system &ndash; a daily &ldquo;show&rdquo;'],
      ['4', 'The repurposing engine'],
      ['5', 'Sales Navigator &ndash; targeting + outbound'],
      ['5b', 'Cold start + network growth'],
      ['6', 'The community + engagement engine'],
      ['7', 'The funnel: every action routes into the AI'],
      ['8', 'Metrics & the optimization loop'],
      ['9', 'Compliance &ndash; the hard guardrails'],
      ['10', 'Three example posts'],
      ['11', 'The 90-day ramp'],
    ],
  },
];

for (const ed of editions) {
  const md = readFileSync(new URL(ed.src, import.meta.url), 'utf8')
    .replace(/^# .*\n/, '')
    .replace(/\n\*[^*]*Airis Solutions[^*]*\*\s*$/, '\n'); // strip trailing italic credit (closing block replaces it)

  const cover = `<div class="cover">
  <div class="cover-inner">
    <div class="cover-kicker">${ed.kicker}</div>
    <div class="lockup"><span class="logo">${logoDark}</span><span class="logo">${logoCgp}</span></div>
    <div class="cover-rule"></div>
    <div class="cover-title">${ed.title}</div>
    <div class="cover-sub">${ed.sub}</div>
  </div>
  <div class="cover-foot"><span>${ed.foot}</span><span>2026</span></div>
</div>

`;

  const tocRows = ed.toc
    .map(([n, t]) => `<li><span class="toc-num">${n}</span><span class="toc-t">${t}</span></li>`)
    .join('\n    ');
  const toc = `<div class="toc">
  <div class="toc-kicker">Airis &times; CryptoGameplan</div>
  <div class="toc-head">${ed.tocHead}</div>
  <ol class="toc-list">
    ${tocRows}
  </ol>
</div>

`;

  const closing = `\n\n<div class="closing"><span class="logo">${logoLight}</span><div class="ctxt">${ed.foot}.<br/>Airis Solutions &middot; AI-driven Business Development</div></div>`;

  const pdf = await mdToPdf(
    { content: cover + toc + md + closing },
    {
      stylesheet: [],
      css,
      document_title: ed.docTitle,
      pdf_options: { printBackground: true, preferCSSPageSize: true },
      launch_options: { args: ['--no-sandbox'] },
    },
  );
  writeFileSync(new URL(ed.out, import.meta.url), pdf.content);
  console.log('✓', ed.out.replace('../', ''));
}
