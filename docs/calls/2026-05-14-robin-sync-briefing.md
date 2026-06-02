# Robin Sync — Call-Briefing

**Datum:** Donnerstag, 2026-05-14
**Teilnehmer:** Felix (Airus), Robin (CGP)
**Slot:** ~45 Minuten
**Ziel:** Robin's Buy-in zum System + Antworten zu den 8 Setup-Fragen, damit wir direkt nach dem Call mit dem Bauen starten können.

---

## Vor dem Call (Felix-Checkliste)

- [ ] `docs/architecture/v1-overview.md` nochmal überflogen
- [ ] `docs/business/dm-flows/opener-patterns.md` und `follow-up-patterns.md` durchgegangen (Final-Slots im Kopf)
- [ ] Browser-Tab mit GHL offen, falls Robin Custom Fields oder Pipeline live zeigen will
- [ ] Sales-Navigator-Tab offen (5 Min reinschauen, damit du weißt, wonach du fragst — Saved Searches, Lead Lists)
- [ ] Notizen-Doc parat, in dem du Robin's Antworten direkt mitschreibst (oder Shared Screen mit diesem File)
- [ ] Zeit zum Atmen 10 Min vor dem Call, damit du nicht in den Call stolperst

---

## Agenda (45 Min — eng getaktet, bei Bedarf auf 60 Min strecken)

| Block | Inhalt | Zeit |
|---|---|---|
| 1 | Recap was bisher passiert ist | 5 min |
| 2 | System-Erklärung (Robin-Sprache) | 10 min |
| 3 | Die 13 Setup-Fragen (8 strategisch + 5 baublockierend) | 25 min |
| 4 | Voice-Final-Slots (Tone-Picks) | 5 min |
| 5 | Nächste Schritte + Timeline | 5 min |

---

## Block 1 — Recap (5 min)

Was du Robin in deinen eigenen Worten sagen kannst:

> Seit dem Handoff-Pack haben wir auf deiner Seite gar nichts mehr verlangt. Wir haben dein Pack in zwei Schritten ergänzt. Erstens die zwei fehlenden Files (opener-patterns + follow-up-patterns) komplett ausgearbeitet, sodass dein Voice-Set jetzt für jeden Schritt durchgängig ist. Zweitens eine v1-Architektur designed, die GHL als Source-of-Truth nutzt, damit du nichts Neues lernen musst. Heute ein paar Setup-Fragen klären, danach baue ich los.

**Wichtig:** keine Tech-Begriffe in der Erklärung. Robin braucht das Bild, nicht den Stack.

---

## Block 2 — System-Erklärung (10 min)

So funktioniert das aus Robin's Perspektive:

```
1. AI macht den ersten DM-Kontakt auf LinkedIn
   (cold outbound oder reply auf deine Posts/CTA)

2. AI führt die 4 Qualifikations-Fragen genau wie wir
   sie zusammen festgelegt haben

3. Qualifizierte Leads bekommen den Booking-Link

4. Du siehst ALLES in deinem GHL: Name, LinkedIn-Profil,
   Q1-Q4, Fit-Tag, das ganze Transkript

5. Vor jedem Call öffnest du den Lead in GHL, liest dich
   ein, gehst informiert in den Call

6. Du kannst jederzeit jeden DM-Thread selbst übernehmen.
   Die AI merkt das und stoppt.
```

**Robin-freundliche Talking Points:**

- "Du musst kein neues Tool lernen. Du bleibst in GHL."
- "Die AI redet nur wie wir es im Voice-Pack festgelegt haben. Kein generisches AI-Geschwafel."
- "Compliance-kritische Sachen (Finanzberatung, Lebenskrise, Regulatoren) bekommt die AI nicht in die Finger. Da stoppt sie und pingt dich."
- "Wir starten mit warmen Leads (deine CTA-Replies, Quiz-Completer). Cold Outbound aktivieren wir erst, wenn das warm-only sauber läuft, damit dein LinkedIn-Account safe bleibt."

---

## Block 3 — Die 13 Setup-Fragen (25 min)

Eine pro Antwort-Zeile mitschreiben. Knapp halten, weitergehen, nicht in Debatten reinrutschen.

**Reihenfolge-Tipp:** Q9 (API), Q10 (Walkthrough), Q11 (Sales Navigator), Q12 (Quiz), Q13 (DNC) sind **bauKritisch**. Wenn die Zeit eng wird, diese zuerst durchziehen, dann Q1-Q8.

### Q1 — Booking-Flow
> Läuft `crypto-gameplan.com/booking` schon über GHL-Calendars heute?

Warum wichtig: bestätigt, dass GHL beim Booking automatisch den Webhook feuert, der die AI stoppt.

**Antwort:**

### Q2 — Pipeline
> Hast du in GHL schon eine Pipeline für CGP-Leads, in die wir die LinkedIn-Leads reinschieben sollen? Oder bauen wir eine neue speziell für LinkedIn-AI?

Warum wichtig: bestimmt Naming, Stages, ob deine bestehenden Reports/Workflows betroffen sind.

**Antwort:**

### Q3 — Volume-Target
> Was ist dein Ziel pro Woche, qualifizierte gebuchte Calls aus LinkedIn?

Warum wichtig: bestimmt die Unipile-Plan-Größe und die LinkedIn-Action-Limits/Tag (Account-Safety).

**Antwort:**

### Q4 — LinkedIn-Account-Status
> Läuft auf deinem LinkedIn-Account aktuell schon irgendeine Automatisierung (Phantombuster, Expandi, Dripify, etc.)? Hast du in der Vergangenheit Restriktionen bekommen?

Warum wichtig: zwei Tools gleichzeitig = Account-Sperre. Wir müssen wissen, ob etwas migrieren / pausieren musst.

**Antwort:**

### Q5 — GHL-Workspace
> Schreiben wir die Leads in deinen normalen GHL-Workspace (mit einem Tag "LinkedIn AI"), oder willst du einen separaten Sub-Account dafür?

Warum wichtig: betrifft Billing, Isolation, ob deine bestehenden Contacts berührt werden.

**Antwort:**

### Q6 — Escalation-Channel
> Wenn die AI auf einen Compliance-Trigger trifft (z.B. jemand fragt nach Finanzberatung, erwähnt Scheidung, ist Journalist), stoppt sie und pingt dich. Wo willst du diesen Ping? Slack, SMS, GHL-Notification, E-Mail?

Warum wichtig: bestimmt das HITL-Setup. Robin muss schnell reagieren können.

**Antwort:**

### Q7 — Unipile-Subscription
> Wir nutzen Unipile (das Tool, das die AI mit deinem LinkedIn verbindet). Kostet ~$50-200/Monat je nach Volume. Zahlt das Airus oder CGP?

Warum wichtig: gehört zur Commercials-Diskussion, blockt Setup nicht. Aber gut, Klarheit zu haben.

**Antwort:**

### Q8 — Bestehende GHL Custom Fields
> Hast du in GHL schon Custom Fields, die wir wiederverwenden sollten (z.B. "Crypto-Erfahrung", "Investiertes Kapital"), oder bauen wir alle neu (Q1, Q2, Q3, Q4, Fit-Tag, etc.)?

Warum wichtig: vermeidet doppelte Felder + nutzt Robin's bestehende Logik.

**Antwort:**

### Q9 — GHL API-Zugang
> Damit unsere AI Leads in dein GHL schreiben kann, brauchen wir API-Zugang. Bist du GHL-Account-Admin und kannst einen API-Key generieren? Oder lädst du mich als Sub-User mit API-Rechten ein?

Warum wichtig: **Hard-Block.** Ohne API-Key kein Sync, kein Build.

**Antwort:**

### Q10 — Walkthrough-Asset
> Wenn jemand auf deine CTA antwortet ("DM me 'system'"), schickt die AI den freien Walkthrough. Wo liegt der und in welchem Format? YouTube-Video, Loom-Recording, PDF, eigene Landing Page? Bitte die URL.

Warum wichtig: **Hard-Block.** Trigger B (CTA-Reply) und beide Value-Touches hängen daran.

**Antwort:**

### Q11 — Sales Navigator + Cold-Lead-Source
> Du hast Sales Navigator. Drei Folgefragen:
> 1. Hast du dort gespeicherte Suchen für deinen ICP (Tech Mid-Senior, Hospitality-Mgmt, $100k+ Crypto)? Oder bauen wir die zusammen?
> 2. Bevorzugst du Connection-First (erst Connection-Request, nach Accept DM) oder direkte InMails an offene Profile?
> 3. Wie viele InMail-Credits hast du aktuell pro Monat? Das limitiert das Cold-Volume.

Warum wichtig: bestimmt die Lead-Pipeline-Source für Trigger A (Cold Outbound). Ohne ICP-Filter kein gezieltes Outbound.

**Antwort:**

### Q12 — Quiz-Integration
> `crypto-gameplan.com/gameplan` — läuft das Quiz auf GHL (eigenes Form), oder extern (Typeform, WordPress, etc.)? Können wir bei Completion einen Webhook abgreifen oder triggern wir es anders?

Warum wichtig: Trigger D (Quiz-Completer) hängt daran. Ohne Webhook keine automatische Follow-up-DM nach Quiz.

**Antwort:**

### Q13 — Bestehende Leads + Do-Not-Contact
> Du hast wahrscheinlich schon Contacts in GHL aus IG, YouTube, Telegram, vorherigen Calls. Zwei Sachen:
> 1. Sollen wir alle bestehenden GHL-Contacts mit einem Tag "Existing — Skip Cold Outbound" markieren, damit die AI keinen versehentlich cold-callt?
> 2. Gibt es Namen auf einer expliziten "Do Not Contact"-Liste (Ex-Kunden, jemand mit dem du dich überworfen hast, Wettbewerber)?

Warum wichtig: schützt deine bestehenden Beziehungen + Brand. Hochnotpeinlich, wenn die AI einen aktiven Kunden mit "Hi, I run CGP..." anschreibt.

**Antwort:**

---

## Block 4 — Voice-Final-Slots (5 min)

Robin muss aus den Voice-Optionen (V1 warm / V2 mittel / V3 kalt) seine Finals picken. Wir gehen die wichtigsten gemeinsam durch.

Was Robin entscheiden muss:
- **Opener-Patterns** (4 Trigger, je V1/V2/V3): Cold Outbound, CTA-Reply "system", Post-Engagement, Quiz-Completer
- **Follow-up-Patterns**: value_touch #2, Mid-Qualification-Re-Engage, Parked-Re-Engage (3 Sub-Cases)

**Vorgehen im Call:**

1. Robin's Default-Temperatur fragen: "Wenn du eine Tendenz hast, eher Mitte (V2) oder eher Kalt (V3)?"
2. Pro Trigger nur 30 Sekunden: V1/V2/V3 vorlesen, Robin pickt
3. Wenn Robin sich nicht entscheiden kann: V2 als Default eintragen, später nachjustieren

**Wenn Zeit knapp wird:** Voice-Picks per Email/Loom nachreichen. Die Setup-Fragen aus Block 3 sind wichtiger für den Call.

---

## Block 5 — Nächste Schritte + Timeline (5 min)

So geht's nach dem Call weiter:

| Zeitraum | Was passiert |
|---|---|
| **Tag 0** (nach Call) | Unipile-Account beantragen, GHL-Setup-Call mit Robin terminieren (30 Min, schnelles Konfigurieren von Pipeline + Custom Fields + Webhook) |
| **Woche 1** | Storage + State Machine + Qualification-Flow gebaut |
| **Woche 2** | AI Brain + Voice-Guards + Compliance-Layer |
| **Woche 3** | LinkedIn-Adapter + GHL-Sync + erste Live-Tests mit warmen Leads (du + Robin reviewen jeden DM-Thread) |
| **Ende Woche 3** | Pilot live für warme Leads (Trigger B + D). Cold Outbound kommt in v1.5 nach 2 Wochen sauberem Pilot-Betrieb. |

**Robin's Commitment für die 3 Wochen:**

- 30 Min GHL-Setup-Call (Tag 0-1)
- 1h Voice-Review (Mitte Woche 2) wenn er die Finals nicht im Sync gepickt hat
- 1-2h Live-Test-Review (Ende Woche 3): erste 5-10 Threads gemeinsam durchgehen, bevor wir den Bot wirklich auf seine Lead-Liste loslassen

Das ist alles. Den Rest baut Airus.

---

## Antizipierte Robin-Fragen (vorbereitet)

Falls Robin sie stellt, hast du die Antwort:

### "Was kostet mich das?"
> Unipile ~$50-200/Monat (siehe Q7), Supabase free tier für v1, GHL nutzen wir auf deinem bestehenden Account. Die Build-Kosten sind Airus-Seite, das klären wir in der Commercials-Convo separat.

### "Wie sicher ist mein LinkedIn-Account?"
> Wir nutzen konservative Action-Limits, Randomization der Sende-Zeiten, und HITL-Checkpoints. Wir starten mit warmen Leads (geringes Spam-Risiko), Cold Outbound aktivieren wir gestaffelt. Du kannst jederzeit den Killswitch ziehen und alle AI-Aktivität pausieren.

### "Kann ich jederzeit eingreifen?"
> Ja. Du sendest selbst eine DM in einen Thread, die AI merkt das und stoppt. Du markierst einen Lead als "Do Not Contact" in GHL, die AI ignoriert ihn. Du pausierst das ganze System in einem Klick.

### "Was wenn die AI Mist baut, also wirklich etwas Falsches sagt?"
> Drei Schutzschichten. Erstens: jede Message läuft durch den Pre-Send-Scan (banned phrases, em-dashes, Compliance-Trigger), und wenn sie durchfällt wird sie blockiert oder rewritten. Zweitens: für 15 definierte Eskalations-Trigger (Finanzberatung, Lebenskrise, Regulator-Anfrage) stoppt sie hart und pingt dich. Drittens: in den ersten 2 Wochen reviewst du jeden Thread vor dem Send, dann gewöhnen wir das ab, sobald das Vertrauen da ist.

### "Wann sehe ich die ersten gebuchten Calls?"
> Ende Woche 3 für die warmen Pfade (CTA-Reply, Quiz-Completer). Cold Outbound ab Woche 5-6, wenn Pilot sauber läuft.

### "Was ist mit den Leuten, die ich schon parked habe?"
> Die fasst die AI nicht an. Wenn die sich von selbst zurückmelden, hat sie einen Re-Engage-Pattern dafür (siehe follow-up-patterns.md Sub-Case 1-3).

### "Habt ihr das schon mal gebaut?"
> Ehrliche Antwort: Airus baut das jetzt zum ersten Mal für CGP, aber die Komponenten (LinkedIn-Bots, AI-Conversation-Engines, CRM-Sync) sind seit 2024 etabliert. Was hier neu ist, ist nicht die Tech, sondern die Tiefe deines Voice-Packs. Genau deshalb haben wir vier Wochen Voice-Definition gemacht, bevor wir eine Zeile Code schreiben.

---

## Wenn Robin sich gegen etwas Grundsätzliches sperrt

Drei Sachen, bei denen Robin's "Nein" das Projekt zurückwirft:

| Robin sagt | Was es bedeutet | Wie du reagierst |
|---|---|---|
| "Cold Outbound will ich gar nicht." | Wir bauen warm-only. Kein Drama, Pilot-Scope wird sogar kleiner. | "Macht Sinn, dann fokussieren wir voll auf CTA + Quiz-Pfade. Spart sogar Zeit." |
| "Ich will keine fremde AI auf meinem LinkedIn." | Account-Safety-Sorge. Tiefer ausgraben, ob es um Tech oder um Brand geht. | "Verstehe. Was wäre nötig, damit du dich damit wohlfühlst? Mehr HITL-Punkte? Oder soll das eine zweite Persona auf einem separaten Account werden?" |
| "GHL soll alles machen, ohne Supabase dazwischen." | Tech-Misverständnis. GHL kann das nicht, weil zu langsam für AI-State. | "GHL ist deine Source-of-Truth, da landet alles. Supabase ist nur Working Memory der AI, das siehst du nie. Wäre wie der Arbeitsspeicher deines Laptops, nicht die Festplatte." |

---

## Nach dem Call (Felix-Checkliste)

- [ ] Antworten zu Q1-Q13 in `docs/architecture/v1-overview.md` ins Decision-Capture eintragen
- [ ] Voice-Finals (soweit gepickt) in `opener-patterns.md` + `follow-up-patterns.md` eintragen
- [ ] Walkthrough-URL in `docs/business/links.md` hinterlegen
- [ ] GHL-API-Key sicher abspeichern (Bitwarden / 1Password, niemals ins Repo)
- [ ] Robin's offene Punkte (was er noch nachreichen muss) zurückspiegeln per Email/Slack
- [ ] Unipile-Account beantragen
- [ ] GHL-Setup-Call mit Robin terminieren (30 Min, idealerweise innerhalb 2 Tagen) — Pipeline, Custom Fields, Webhook live konfigurieren
- [ ] Start Code-Repo: TypeScript-Projekt, Supabase-Account, GitHub
- [ ] Build-Plan in Tages-Tasks runterbrechen (machen wir zusammen)

---

## Vollständigkeits-Check: Was nach dem Call zum Bauen vorhanden sein muss

Wenn am Donnerstag um 17 Uhr alles richtig läuft, hast du das hier in der Hand:

| Asset | Quelle | Status nach Call |
|---|---|---|
| LinkedIn-Credentials | Hast du bereits | ✅ |
| Sales Navigator Access | Hast du bereits | ✅ |
| GHL-API-Key | Q9 | ✅ |
| GHL-Pipeline-Setup | Q2 (+ Setup-Call Tag 0-1) | ⏳ in 2 Tagen |
| GHL-Custom-Fields-Definition | Q8 (+ Setup-Call) | ⏳ in 2 Tagen |
| GHL-Booking-Webhook-Config | Q1 (+ Setup-Call) | ⏳ in 2 Tagen |
| Walkthrough-URL | Q10 | ✅ |
| Sales-Navigator-ICP-Suchen | Q11 | ✅ oder gemeinsam gebaut |
| Quiz-Integration-Pfad | Q12 | ✅ |
| DNC-Liste + Existing-Leads-Tag | Q13 | ✅ |
| Voice-Final-Picks | Block 4 | ✅ (oder V2 als Default) |
| Volume-Target | Q3 | ✅ |
| Escalation-Channel | Q6 | ✅ |
| Commercials Airus↔CGP | Q7 (separate Convo) | ⏳ parallel |

**Wenn nach dem Call irgendetwas in der "Status"-Spalte rot ist, wird der Build verzögert.** Deshalb sind Q9-Q13 die wichtigsten — die hängen sonst nicht in den Standard-Sync-Fragen mit drin.
