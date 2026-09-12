# Targeting-Brief für die erste Liste

Zum Danebenlegen beim Bauen der Suche. Übersetzt [icp.md](./icp.md) in Filter, die die Suche
tatsächlich kennt.

**Ziel:** eine erste Liste von **50–100 Profilen**. Nicht mehr. Die Annahmequote dieser
Liste ist der Test, ob das Targeting stimmt — bei einer schlechten Liste zahlt Robins
Account die Rechnung, nicht wir.

---

## Womit gesucht wird (Stand 12.09.2026)

**Nicht mit Sales Navigator.** Robins verbundener Account hat kein aktives Sales-Navigator-Abo
— die Sales-Navigator-Suche antwortet über Unipile mit `403 feature_not_subscribed`. Auch
kein PhantomBuster: das Konto hat keine Phantoms mehr, und ein zweites Werkzeug auf Robins
LinkedIn ist ohnehin gegen seine Ansage vom 23.06.

Gesucht wird über **unsere eigene Verbindung**, mit der normalen LinkedIn-Personensuche:

```bash
npm run search:leads -- --location "Switzerland" --industry "Software Development" \
                        --keywords "director" --count 60
```

Das schreibt eine CSV nach `lists/`, die der Import direkt liest. Kein Abo, kein Export-Tool,
kein zweiter Automat auf dem Account. Die Treffer enthalten bereits die interne Profil-ID, die
zum Verschicken der Anfrage nötig ist — der Auflösungsschritt entfällt.

**Was das kostet:** die normale Suche hat weniger Filter als Sales Navigator. Seniorität,
Firmengröße, Jahre Erfahrung, „Jobwechsel in den letzten 90 Tagen" und „hat kürzlich gepostet"
gibt es dort **nicht**. Übrig bleiben Region, Branche, Stichwort und Netzwerk-Grad. Der Rest
dieses Briefs sagt bei jedem Filter dazu, ob er noch verfügbar ist — und was ihn ersetzt.

Sollte Robin später doch Sales Navigator buchen, sind die feineren Filter wieder da; der Rest
des Ablaufs bleibt identisch.

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

### Seniorität → läuft über `--keywords`

Einen echten Senioritätsfilter gibt es in der normalen Suche nicht. Ersatz: das Stichwort.
Eine Suche pro Stufe, nicht alle in einen Topf:

```
--keywords "director"      --keywords "managing director"
--keywords "vp"            --keywords "head of"
--keywords "founder"       --keywords "cto"      --keywords "ceo"
```

Seniorität trifft Kapital besser als jeder Jobtitel. Mehrere schmale Läufe sind hier kein
Nachteil, im Gegenteil: du siehst hinterher, welche Stufe welche Annahmequote hat.

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

LinkedIn hat einige Branchen umbenannt („Computer Software" heißt heute „Software
Development"). Das Skript schlägt den Namen nach und **schreibt hin, was es tatsächlich
getroffen hat** — kurz drüberschauen, bevor die Suche läuft.

### Branche — ausschließen (nicht verhandelbar)
```
Financial Services · Banking · Investment Management · Investment Banking
Capital Markets · Venture Capital & Private Equity · Insurance · Accounting
```
Der ICP sagt es klar: Finanzleute haben schon ein Framework. Falscher Käufer.

**Die normale Suche kann Branchen nicht ausschließen** — nur einschließen. Deshalb passiert
der Ausschluss eine Stufe später, **automatisch beim Listenbau**: Profile, deren Überschrift
Krypto oder Finanzen als *Beruf* ausweist (Trader, VC/PE, Vermögensverwaltung,
Finanzberater, Versicherungsmakler, Banker), fliegen raus, bevor sie in der CSV landen. Das
Skript meldet die Zahl als „aussortiert (ICP)".

Die Regel ist bewusst eng gefasst: ein bloßes „Investor" in der Überschrift genügt **nicht**
zum Ausschluss — ein Tech-Gründer, der nebenbei angel-investiert, ist ein guter Lead. Wer die
Liste roh sehen will, hängt `--keep-all` an.

### Region
```
United States · United Kingdom · Canada · Australia · Singapore · UAE
Deutschland · Österreich · Schweiz
```
DACH ist mit drin, weil das System die Sprache automatisch umschaltet — es erkennt
DACH-Standorte und schreibt dann auf Deutsch. Kostet dich keine Extraarbeit.

Falls du die Liste kleiner halten willst: **Schweiz und UAE zuerst.** Höchste Kapitaldichte
pro Profil.

### Netzwerk-Grad
Standard: **2. Grad**. Der 1. Grad ist bereits vernetzt, da gibt es nichts einzuladen; beim
3. Grad verlangt LinkedIn für die Anfrage oft eine E-Mail-Adresse, die wir nicht haben. Über
`--distance 2,3` lässt sich das aufmachen, lohnt aber erst, wenn der 2. Grad leergelaufen ist.

### Firmengröße und Jahre Erfahrung — nicht verfügbar
Beides gibt es nur in Sales Navigator. Ersatz ist dein Blick auf die CSV: Überschrift und
Region stehen in jeder Zeile, Solo-Selbstständige und Junior-Rollen sind daran in Sekunden
erkennbar. Bei 50–100 Zeilen ist das eine Viertelstunde — und die ist gut investiert, weil
eine schlechte Liste auf Robins Account geht.

---

## Was du NICHT filterst

| Nicht filtern | Warum |
|---|---|
| Stichwort „Crypto" / „Bitcoin" / „Web3" | Liefert Leute, die beruflich in Krypto sind — Trader, Influencer, Exchange-Leute. Ausdrücklicher Disqualifikator im ICP. |
| „Investor" als Stichwort | Trifft VC/PE, also die ausgeschlossene Finanzbranche. |
| Enge Jobtitel-Ketten | Ein Stichwort pro Lauf. „senior director of engineering" trifft fast nichts. |

**Wenn du Krypto-Affinität doch vorfiltern willst:** nicht über den Beruf, sondern über
*Verhalten* — Follower von seriösen Krypto-Analysten, Mitglieder relevanter Gruppen. Über die
normale Suche geht das nicht und ist für Liste 1 den Aufwand nicht wert. Wir sehen in Q1/Q4,
wer passt.

---

## Zwei Filter, die es leider nicht mehr gibt

**„Changed jobs in the past 90 days"** (frisches Geld, offener für Neues) und **„Posted on
LinkedIn in the past 30 days"** (aktive Accounts statt Karteileichen) waren die beiden
stärksten Zusatzfilter — **beide nur in Sales Navigator.**

Der Ersatz für „hat kürzlich gepostet" ist indirekt: **erst der Content-Plan, dann die
Liste.** Wer Robins Beiträge sieht, nimmt die Anfrage eher an. Solange auf dem Profil nichts
passiert, ist die Anfrage kalt und die Annahmequote entsprechend.

---

## Suche → Liste → Import

Drei Schritte, dazwischen schaust du drauf:

```bash
# 1. Liste bauen (liest nur, verschickt nichts)
npm run search:leads -- --location "Switzerland" --industry "Software Development" \
                        --keywords "director" --count 60

# 2. CSV in lists/ öffnen, Zeilen rauswerfen die nicht passen

# 3. Trockenlauf, dann scharf
npm run import:leads -- lists/<datei>.csv --dry-run
npm run import:leads -- lists/<datei>.csv
```

**Der Import verschickt nichts sofort.** Er legt die Liste nur in die Warteschlange; die
täglichen Läufe tröpfeln die Anfragen im Rahmen des Tagesbudgets raus (aktuell 2 pro Lauf,
4 Läufe am Tag, gedeckelt auf 15 Aktionen).

**Die Sprache kommt nicht aus der CSV**, sondern aus dem LinkedIn-Standort: DACH-Profile
bekommen den Opener auf Deutsch, alle anderen auf Englisch.

Eine fremde CSV (Sales-Nav-Export o. ä.) funktioniert weiterhin — sie braucht nur eine Spalte
mit der Profil-URL (`profileUrl`, `linkedinUrl`, `url` … werden erkannt). Dann wird jedes
Profil einzeln nachgeschlagen, was langsamer ist und häufiger scheitert.

**`lists/` liegt bewusst außerhalb des Repos** (in `.gitignore`): das sind Namen und Profile
echter Menschen.

---

## Was danach passiert

Anfrage raus → Annahme (LinkedIn meldet das mit bis zu 8 Stunden Verzug) → Opener → Q1–Q4
im Chat → Termin. Jede Nachricht geht weiterhin über deine Freigabe, solange HITL an ist.

**Die Zahl, auf die du schaust, ist die Annahmequote.** Unter 20 % stimmt das Targeting
nicht — dann Liste stoppen und Filter nachschärfen, nicht mehr vom Gleichen nachkippen.
Steht im Dashboard.
