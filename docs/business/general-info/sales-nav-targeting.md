# Sales Navigator — Targeting-Brief für die erste Liste

Zum Danebenlegen beim Bauen der Suche. Übersetzt [icp.md](./icp.md) in Filter, die es in
Sales Navigator tatsächlich gibt.

**Ziel:** eine erste Liste von **50–100 Profilen**. Nicht mehr. Die Annahmequote dieser
Liste ist der Test, ob das Targeting stimmt — bei einer schlechten Liste zahlt Robins
Account die Rechnung, nicht wir.

---

## Die Grundspannung dieser Suche

Der ICP ist über **Vermögen und Krypto-Erfahrung** definiert. Beides steht nicht im
LinkedIn-Profil. Was drinsteht, sind Beruf, Seniorität und Region.

Also filtern wir auf das, was mit Kapital korreliert — Senior-Rolle, teure Region, reifes
Alter — und lassen die Krypto-Frage bewusst offen. **Die beantwortet der Chat, nicht der
Filter.** Genau dafür sind Q1 und Q4 im Qualifizierungs-Flow da.

Die Versuchung, „Crypto" ins Suchfeld zu tippen, ist der teuerste Fehler dieser Suche:
Man bekommt Leute, die *beruflich* mit Krypto zu tun haben — Trader, Influencer,
Exchange-Mitarbeiter. Das ist exakt der ausgeschlossene Käufer.

---

## Filter, die du setzt

### Seniorität
`Owner / Partner / CXO / Vice President / Director / Senior`

Trifft Kapital besser als jeder Jobtitel. Entry-Level und Praktikanten raus.

### Branche — einschließen
```
Information Technology & Services · Computer Software · Internet
Management Consulting · Hospital & Health Care · Medical Practice
Law Practice · Legal Services
Mechanical/Industrial Engineering · Construction · Architecture & Planning
Hospitality · Restaurants · Real Estate
```
Nicht alle auf einmal. Besser: **zwei bis drei Branchen pro Suche**, dann siehst du
hinterher, welche Branche welche Annahmequote hat. Bei einem einzigen Topf mit allem
lernst du daraus nichts.

### Branche — ausschließen (nicht verhandelbar)
```
Financial Services · Banking · Investment Management · Investment Banking
Capital Markets · Venture Capital & Private Equity · Insurance · Accounting
```
Der ICP sagt es klar: Finanzleute haben schon ein Framework. Falscher Käufer.

### Region
```
United States · United Kingdom · Canada · Australia · Singapore · UAE
Deutschland · Österreich · Schweiz
```
DACH ist mit drin, weil das System die Sprache automatisch umschaltet — es erkennt
DACH-Standorte und schreibt dann auf Deutsch. Kostet dich keine Extraarbeit.

Falls du die Liste kleiner halten willst: **Schweiz und UAE zuerst.** Höchste Kapitaldichte
pro Profil.

### Firmengröße
`11–50 · 51–200 · 201–500 · 501–1000 · 1001–5000`

Solo-Selbstständige raus (Kapital meist im eigenen Geschäft gebunden), Großkonzern-Angestellte
weiter unten in der Hierarchie ebenfalls.

### Jahre Erfahrung
`10+ Jahre`

Der beste verfügbare Näherungswert für Alter 30–55. Sales Navigator hat keinen Altersfilter.

---

## Was du NICHT filterst

| Nicht filtern | Warum |
|---|---|
| Stichwort „Crypto" / „Bitcoin" / „Web3" | Liefert Leute, die beruflich in Krypto sind — Trader, Influencer, Exchange-Leute. Ausdrücklicher Disqualifikator im ICP. |
| „Investor" im Titel | Trifft VC/PE, also die ausgeschlossene Finanzbranche. |
| Jobtitel-Freitext generell | Zu eng. Seniorität + Branche trifft dieselbe Gruppe zuverlässiger. |

**Wenn du Krypto-Affinität doch vorfiltern willst:** nicht über den Beruf, sondern über
*Verhalten* — Follower von seriösen Krypto-Analysten, Mitglieder relevanter Gruppen. Das
geht in Sales Navigator nur begrenzt und ist für Liste 1 den Aufwand nicht wert. Wir sehen
in Q1/Q4, wer passt.

---

## Zwei Filter, die überproportional viel bringen

**„Changed jobs in the past 90 days"** — frisches Geld, neues Gehalt, oft ein Bonus. Und
Menschen in Veränderung sind offener für neue Systeme.

**„Posted on LinkedIn in the past 30 days"** — aktive Accounts. Eine Verbindungsanfrage an
eine Karteileiche wird nie angenommen und verbrennt trotzdem dein Tagesbudget.

Wenn du nur zwei Zusatzfilter setzt, dann diese beiden.

---

## Export → Import

Der Export braucht **eine Spalte mit der Profil-URL**. Die Benennung ist egal, das Skript
erkennt `profileUrl`, `linkedinUrl`, `url`, `profile` und ein paar mehr. Vor- und Nachname
werden mitgenommen, wenn sie da sind — sonst holt das System sie selbst.

Alles andere ignorieren wir. **Die Sprache kommt nicht aus dem CSV**, sondern aus dem
LinkedIn-Standort, den wir beim Auflösen des Profils selbst abfragen.

```bash
npm run import:leads -- liste.csv --dry-run   # nichts geht raus, nur Vorschau
npm run import:leads -- liste.csv             # in die Warteschlange
```

**Immer erst mit `--dry-run`.** Der zeigt, wie viele Profile sauber aufgelöst wurden. Sind
das deutlich weniger als die Zeilen im CSV, stimmt etwas mit dem Export nicht — dann nicht
scharf schalten.

Der zweite Befehl **verschickt nichts sofort.** Er legt die Liste nur in die Warteschlange;
die täglichen Läufe tröpfeln die Anfragen dann im Rahmen des Tagesbudgets raus.

---

## Was danach passiert

Anfrage raus → Annahme (LinkedIn meldet das mit bis zu 8 Stunden Verzug) → Opener → Q1–Q4
im Chat → Termin. Jede Nachricht geht weiterhin über deine Freigabe, solange HITL an ist.

**Die Zahl, auf die du schaust, ist die Annahmequote.** Unter 20 % stimmt das Targeting
nicht — dann Liste stoppen und Filter nachschärfen, nicht mehr vom Gleichen nachkippen.
Steht im Dashboard.
