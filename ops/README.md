# Alarme einrichten (n8n)

Das System schickt zwei Arten von Meldungen an eine Webhook-Adresse:

| `kind` | Wann | Wer muss es sehen |
|---|---|---|
| `escalation` | Ein Lead braucht einen echten Menschen — Erbschaft, Scheidung, finanzielle Notlage, Journalist, Regulierer, oder ein Grenzfall vor dem Call. Die KI antwortet dann nur noch „ich hol Robin dazu" und hört auf. | **Robin** (und Felix) |
| `compliance` | Ein Entwurf wurde zurückgehalten, weil er eine Compliance-Regel verletzt hat. | **Nur Felix** — das ist Technik |
| `system` | Etwas in der Maschinerie hängt. | **Nur Felix** |

Die Trennung ist Absicht: Robin soll die Fälle sehen, in denen ein Kunde auf ihn wartet —
nicht, dass die KI beinahe etwas Falsches gesagt hätte. Das würde nur Vertrauen kosten.

## Stand (eingerichtet am 11.08.2026)

Läuft bereits in n8n — Workflow **„CGP LinkedIn AI — Alarme"**, ID `58PF1PwJjZ1r0G0H`, aktiv.

- Telegram-Bot: **@airisassistent_bot** (bestehender Airis-Bot, gehört Christians Konto)
- Ziel beider Zweige: Telegram-Gruppe **„Airis"**
- Die Webhook-Adresse enthält einen zufälligen Pfad, damit niemand Fremdes Nachrichten in
  die Gruppe schicken kann. Sie steht in der lokalen `.env` unter `ALERT_WEBHOOK_URL` und
  in Vercel — **nicht ins Repo committen.**

Die Datei `n8n-alerts-workflow.json` bleibt als Vorlage liegen, falls der Workflow neu
aufgesetzt werden muss.

### Wenn Robin dazukommen soll

Im n8n-Workflow beim Knoten **„Eskalation → Gruppe"** die Chat-ID auf eine neue Gruppe mit
Robin ändern. „Technik → Gruppe" bleibt wie es ist. Kein Deploy nötig.

## Testen

```bash
curl -X POST "<deine-webhook-url>" -H 'content-type: application/json' \
  -d '{"kind":"escalation","title":"Testalarm","detail":"Nur ein Test.","text":"🚨 Testalarm\nNur ein Test."}'
```

Kommt die Nachricht in der Gruppe an, steht es.

## Was das System schickt

```json
{
  "kind": "escalation",
  "title": "Lead braucht einen Menschen (pitch_call)",
  "detail": "Er schrieb: \"...\"",
  "leadId": "uuid",
  "context": { "node": "pitch_call", "stage": "qualified" },
  "text": "🚨 fertig formatierte Zeile fürs Handy"
}
```

`text` ist bereits versandfertig — deshalb braucht n8n keine eigene Formatierung.

## Wenn Robin (noch) nicht mit rein soll

Beide Chat-IDs auf Felix setzen. Robin lässt sich später mit einer Änderung dazuholen,
ohne dass am Code etwas passiert.
