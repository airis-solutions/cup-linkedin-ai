# CGP × Airus — Setup-Fragebogen

Hi Robin, da Donnerstag nicht geklappt hat, hier ein kurzer Async-Fragebogen, damit wir nicht auf den nächsten gemeinsamen Slot warten müssen.

**Format:** antworte direkt im Dokument, oder kopier es in eine Email, was für dich schneller ist.
**Aufwand:** ~15 bis 20 Minuten für alles.
**Was danach passiert:** sobald deine Antworten da sind, fängt Airus mit dem Bauen an. Die fünf 🚧 Fragen sind Hard-Blocker, also wenn du nur Zeit für einen Teil hast, fang mit denen an.

---

## 1. GHL-Setup (5 Fragen)

### 1.1 — GHL API-Zugang 🚧
Damit die AI Leads in dein GHL schreiben kann, brauchen wir API-Zugriff. Zwei Wege funktionieren für uns:
- (a) Du generierst einen API-Key und schickst ihn mir (sicherer Kanal: 1Password-Share oder Passwort-Manager-Link, nicht einfach per Email).
- (b) Du lädst mich als Sub-User in deinem GHL-Workspace ein, mit API-Rechten.

Was passt dir besser?

**Antwort:**

### 1.2 — Bestehender Workspace oder separater Sub-Account
Soll die AI in deinen normalen GHL-Workspace schreiben (mit einem Tag wie "LinkedIn AI", damit du filtern kannst), oder willst du einen separaten Sub-Account nur für LinkedIn-Leads?

**Antwort:**

### 1.3 — Booking-Flow
Läuft `crypto-gameplan.com/booking` heute schon über GHL-Calendars? Falls ja, hängen wir uns an den bestehenden Webhook. Falls nein, wo läuft das Booking aktuell?

**Antwort:**

### 1.4 — Pipeline-Setup
Hast du in GHL schon eine Pipeline für CGP-Leads, in die wir die LinkedIn-Leads schreiben sollen? Oder bauen wir eine frische Pipeline speziell für LinkedIn AI (Stages wären: Qualifying → Qualified → Call Booked Pending → Call Booked → Closed/Parked)?

**Antwort:**

### 1.5 — Bestehende Custom Fields
Gibt es Custom Fields auf Contacts in deinem GHL, die wir wiederverwenden sollten (z.B. "Crypto-Erfahrung", "Investiertes Kapital")? Oder bauen wir alles neu (Q1, Q2, Q3, Q4, Fit-Tag, Soft-Signals, Source-Attribution, Transcript-Link)?

**Antwort:**

---

## 2. Lead-Quellen & Assets (3 Fragen)

### 2.1 — Walkthrough-Asset 🚧
Wenn jemand auf deine CTA "DM me 'system'" antwortet, schickt die AI den freien Walkthrough. Wir brauchen:
- Wo es liegt (YouTube-Video, Loom-Recording, PDF, Landing Page, etc.)
- Die genaue URL

**Antwort:**

### 2.2 — Sales Navigator + Cold-Outbound-Source 🚧
Du hast Sales Navigator. Drei Unterfragen:

(a) Hast du dort schon gespeicherte Suchen für deinen ICP (z.B. Tech Mid-Senior mit Crypto-Background, Hospitality-Management, Founders mit Kapital)? Falls ja, zeig sie uns. Falls nein, bauen wir die in einer 30-Minuten-Working-Session zusammen.

(b) Bevorzugte Outbound-Strategie: soll die AI Connection-Requests zuerst senden und dann nach Accept eine DM, oder direkt InMails an offene Profile? (Connection-first ist safer für den Account, InMails sind schneller.)

(c) Wie viele InMail-Credits hast du grob pro Monat in deinem Sales-Navigator-Plan? Das limitiert das Cold-Outbound-Volumen.

**Antwort (a):**

**Antwort (b):**

**Antwort (c):**

### 2.3 — Quiz-Integration 🚧
`crypto-gameplan.com/gameplan` — läuft das Quiz auf GHL (natives Form), oder extern (Typeform, Custom WordPress, etc.)? Die AI muss wissen, wenn jemand das Quiz abgeschlossen hat, damit sie per LinkedIn-DM nachfassen kann. Üblicherweise über einen Webhook bei Completion.

**Antwort:**

---

## 3. Operations (3 Fragen)

### 3.1 — Volume-Target
Was ist dein Ziel an qualifizierten gebuchten Calls pro Woche aus LinkedIn? Das bestimmt den Unipile-Plan und die täglichen LinkedIn-Action-Limits (die deinen Account vor Sperren schützen).

**Antwort:**

### 3.2 — LinkedIn-Account-Status
Zwei Unterfragen zu deinem LinkedIn-Account:

(a) Läuft aktuell ein Automatisierungs-Tool auf dem Account (Phantombuster, Expandi, Dripify, Lemlist, etc.)? Falls ja, müssen wir uns abstimmen, damit wir uns nicht in die Quere kommen.

(b) Hattest du in den letzten 6 Monaten Restriktionen, Warnungen oder temporäre Sperren auf dem Account?

**Antwort (a):**

**Antwort (b):**

### 3.3 — Compliance-Eskalation
Wenn die AI auf einen Compliance-Trigger trifft (jemand fragt nach Finanzberatung, erwähnt Scheidung/Erbe, gibt sich als Journalist oder Regulator zu erkennen, etc.), pausiert sie den Thread und pingt dich. Wo willst du diesen Ping?
- Slack-DM
- SMS
- GHL-Notification
- Email
- WhatsApp

**Antwort:**

---

## 4. Bestehende Leads & Reputation (1 Frage)

### 4.1 — Bestehende Contacts + Do-Not-Contact-Liste 🚧
Zwei Teile:

(a) Du hast schon Contacts in GHL aus IG, YouTube, Telegram, früheren Calls. Damit die AI keinen bestehenden Kunden oder warmen Kontakt versehentlich cold-DMt, würden wir vor Go-Live alle deine bestehenden GHL-Contacts mit einem Tag "Existing — Skip Cold Outbound" markieren. OK für dich?

(b) Gibt es Namen, die explizit auf eine Do-Not-Contact-Liste sollen (Ex-Kunden, Wettbewerber, Leute mit denen du dich überworfen hast)? Namen oder LinkedIn-URLs reichen.

**Antwort (a):**

**Antwort (b):**

---

## 5. Commercials (1 Frage)

### 5.1 — Unipile-Subscription
Wir nutzen Unipile, um die AI mit deinem LinkedIn zu verbinden (ca. $50 bis $200/Monat je nach Volumen). Wer übernimmt das, Airis oder CGP? Das ist getrennt vom Build-Cost, den wir in unserer Commercials-Convo separat klären.

**Antwort:**

---

## 6. Voice-Picks (separat, kein Stress)

Das hier ist etwas länger und macht mehr Sinn, wenn du die Copy im Kontext liest. In zwei Files gibt es Voice-Optionen, wo du V1 (warm), V2 (mittel), V3 (kalt) picken oder eine eigene Variante schreiben sollst:

- `docs/business/dm-flows/opener-patterns.md` — 4 Trigger (Cold Outbound, "system"-CTA-Reply, Post-Engagement, Quiz-Completer)
- `docs/business/dm-flows/follow-up-patterns.md` — value_touch #2, Mid-Qualification-Re-Engage, Parked-Re-Engage (3 Sub-Cases)

**Zwei Wege wie wir das händeln:**

(a) **Quick path:** sag mir deine Default-Temperatur (warm / mittel / kalt), und wir locken V2 als Default überall. Du kannst einzelne Messages später anpassen, wenn du sie im Einsatz siehst.

(b) **Detail path:** geh durch beide Files, pick deine V1/V2/V3 (oder schreib ein V4) für jeden Slot, trag das in die `**Final:**`-Slots ein.

**Deine Wahl:**

---

## Prio-Reihenfolge falls die Zeit knapp ist

Antworte in dieser Reihenfolge:

1. **1.1** (GHL API-Zugang) 🚧
2. **2.1** (Walkthrough-URL) 🚧
3. **2.2** (Sales Navigator) 🚧
4. **2.3** (Quiz-Integration) 🚧
5. **4.1** (Bestehende Contacts + DNC) 🚧
6. Der Rest.

---

## Nach deiner Rückmeldung

Wir machen drei Dinge:

1. 30-Minuten-Live-Call für das GHL-Setup (Pipeline, Custom Fields, Booking-Webhook live konfigurieren). Da brauchen wir dich kurz in der GHL-Oberfläche, aber maximal 30 Minuten.
2. Voice-Picks finalisieren (entweder dein Quick-Path-Default oder deine Detail-Picks).
3. Build starten. Realistisches Pilot-Live-Datum: ~3 Wochen ab Kickoff, abgedeckt sind warme Pfade (CTA-Replies + Quiz-Completer). Cold Outbound geht ~2 Wochen später live, sobald der warme Pilot sauber läuft.

Danke dir Robin. Falls Rückfragen, jederzeit melden.

— Felix
